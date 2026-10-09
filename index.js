require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { sendWelcomeEmail } = require('./mail');

const app = express();
const port = process.env.PORT || 5000;



const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:3000'].filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());


// Database (the driver connects automatically on the first query)

const client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

const database = client.db(process.env.AUTH_DB_NAME);

const jobCollection = database.collection('jobs');
const companyCollection = database.collection('companies');
const usersCollection = database.collection('user');
const applicationsCollection = database.collection('applications');
const planCollection = database.collection('plans');
const subscriptionCollection = database.collection('subscriptions');
const sessionCollection = database.collection('session');

client
    .db('admin')
    .command({ ping: 1 })
    .then(() => console.log('Pinged your deployment. You successfully connected to MongoDB!'))
    .catch((error) => console.error('MongoDB connection error:', error.message));


subscriptionCollection
    .createIndex({ sessionId: 1 }, { unique: true, sparse: true })
    .catch((error) => console.error('Could not create subscriptions index:', error.message));


// Helpers

const COMPANY_STATUSES = ['Pending', 'Approved', 'Rejected'];
const PAID_PLAN_IDS = ['seeker_pro', 'seeker_premium', 'recruiter_growth', 'recruiter_enterprise'];
const HIDDEN_JOB_STATUSES = ['closed', 'draft', 'inactive'];

const toObjectId = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : null);
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pick = (source = {}, fields = []) => {
    const result = {};
    for (const field of fields) {
        if (source[field] !== undefined) result[field] = source[field];
    }
    return result;
};


// Auth middleware

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' });
    }

    const session = await sessionCollection.findOne({ token });
    if (!session || (session.expiresAt && new Date(session.expiresAt) < new Date())) {
        return res.status(401).send({ message: 'unauthorized access' });
    }

    let user = await usersCollection.findOne({ _id: session.userId });
    if (!user && ObjectId.isValid(session.userId)) {
        user = await usersCollection.findOne({ _id: new ObjectId(session.userId) });
    }
    if (!user) {
        return res.status(401).send({ message: 'unauthorized access' });
    }
    if (user.banned) {
        return res.status(403).send({ message: 'account suspended' });
    }

    req.user = user;
    next();
};

const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
        return res.status(403).send({ message: 'forbidden access' });
    }
    next();
};

const verifySeeker = requireRole('seeker');
const verifyRecruiter = requireRole('recruiter');
const verifyAdmin = requireRole('admin');


const verifyInternal = (req, res, next) => {
    const expected = process.env.INTERNAL_API_KEY;
    const received = req.headers['x-internal-key'];
    if (!expected || typeof received !== 'string') {
        return res.status(401).send({ message: 'unauthorized access' });
    }
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).send({ message: 'unauthorized access' });
    }
    next();
};


// Routes

app.get('/', (req, res) => {
    res.send('I am CareerLib backend!');
});


app.post('/api/internal/welcome-email', verifyInternal, async (req, res) => {
    const { email, name } = req.body || {};
    if (!email) {
        return res.status(400).send({ success: false, message: 'email is required' });
    }
    const result = await sendWelcomeEmail(email, name);
    res.send(result);
});

//  Jobs 
app.get('/api/jobs', async (req, res) => {
    const { search, jobType, jobCategory, isRemote, companyId, status, page, perPage } = req.query;
    const query = {};

    if (search) {
        const regex = { $regex: escapeRegex(search), $options: 'i' };
        query.$or = [{ jobTitle: regex }, { companyName: regex }];
    }
    if (jobType) query.jobType = String(jobType);
    if (jobCategory) query.jobCategory = String(jobCategory);
    if (isRemote === 'true') query.isRemote = true;
    if (companyId) query.companyId = String(companyId);

    // An explicit status is only honoured together with a companyId (recruiter views).
    // Public visitors never see closed / draft / inactive jobs.
    if (companyId && status) {
        query.status = String(status);
    } else {
        query.status = { $nin: HIDDEN_JOB_STATUSES };
    }

    if (page) {
        const currentPage = Math.max(parseInt(page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(perPage, 10) || 12, 1), 50);
        const total = await jobCollection.countDocuments(query);
        const jobs = await jobCollection
            .find(query)
            .sort({ createdAt: -1 })
            .skip((currentPage - 1) * limit)
            .limit(limit)
            .toArray();
        return res.send({ total, jobs });
    }

    const result = await jobCollection.find(query).sort({ createdAt: -1 }).toArray();
    res.send(result);
});

app.get('/api/jobs/:id', async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) {
        return res.status(404).json(null);
    }
    const job = await jobCollection.findOne({ _id: id });
    if (!job) {
        return res.status(404).json(null);
    }
    res.send(job);
});

app.post('/api/jobs', verifyToken, verifyRecruiter, async (req, res) => {
    const body = req.body || {};

    const companyObjectId = toObjectId(body.companyId);
    if (!companyObjectId) {
        return res.status(400).send({ message: 'A valid company is required' });
    }

    const company = await companyCollection.findOne({ _id: companyObjectId });
    if (!company || company.recruiterId !== req.user._id.toString()) {
        return res.status(403).send({ message: 'forbidden access' });
    }
    if (company.status !== 'Approved') {
        return res.status(400).send({ message: 'Your company must be approved before posting jobs' });
    }
    if (!body.jobTitle || !body.jobCategory || !body.jobType) {
        return res.status(400).send({ message: 'Job title, category and type are required' });
    }

    const newJob = {
        ...pick(body, [
            'jobTitle',
            'jobCategory',
            'jobType',
            'minSalary',
            'maxSalary',
            'currency',
            'location',
            'deadline',
            'responsibilities',
            'requirements',
            'benefits',
        ]),
        isRemote: body.isRemote === true,
       
        companyId: company._id.toString(),
        companyName: company.name,
        companyLogo: company.logo || '',
        postedBy: req.user._id.toString(),
        status: 'active',
        isPubliclyVisible: true,
        createdAt: new Date(),
    };

    const result = await jobCollection.insertOne(newJob);
    res.send(result);
});

//  Applications 
app.get('/api/applications', verifyToken, verifySeeker, async (req, res) => {
    const ownId = req.user._id.toString();

    if (req.query.applicantId && req.query.applicantId !== ownId) {
        return res.status(403).send({ message: 'forbidden access' });
    }

    const query = { applicantId: ownId };
    if (req.query.jobId) {
        query.jobId = String(req.query.jobId);
    }

    const result = await applicationsCollection.find(query).sort({ createdAt: -1 }).toArray();
    res.send(result);
});

app.post('/api/applications', verifyToken, verifySeeker, async (req, res) => {
    const body = req.body || {};

    const jobObjectId = toObjectId(body.jobId);
    if (!jobObjectId) {
        return res.status(400).send({ message: 'A valid job is required' });
    }
    const job = await jobCollection.findOne({ _id: jobObjectId });
    if (!job) {
        return res.status(404).send({ message: 'Job not found' });
    }

    const newApplication = {
        ...pick(body, ['resumeLink', 'portfolioLink', 'additionalNotes']),
        jobId: job._id.toString(),
        jobTitle: job.jobTitle,
        companyId: job.companyId,
        companyName: job.companyName,
        // Applicant details always come from the logged-in user
        applicantId: req.user._id.toString(),
        applicantName: req.user.name,
        applicantEmail: req.user.email,
        status: 'applied',
        createdAt: new Date(),
    };

    const result = await applicationsCollection.insertOne(newApplication);
    res.send(result);
});

// Companies 
app.get('/api/companies', verifyToken, verifyAdmin, async (req, res) => {
    const companies = await companyCollection.find().sort({ createdAt: -1 }).toArray();

    const counts = await jobCollection
        .aggregate([{ $group: { _id: '$companyId', count: { $sum: 1 } } }])
        .toArray();
    const countMap = new Map(counts.map((item) => [item._id, item.count]));

    for (const company of companies) {
        company.jobCount = countMap.get(company._id.toString()) || 0;
    }
    res.send(companies);
});

app.get('/api/stats', async (req, res) => {
    const pipeline = [
        { $group: { _id: '$jobType', count: { $sum: 1 } } },
        { $project: { jobType: '$_id', _id: 0, count: 1 } },
        { $sort: { count: 1 } },
    ];
    const result = await jobCollection.aggregate(pipeline).toArray();
    res.send(result);
});

// The logged-in recruiter's own company (empty object if none yet)
app.get('/api/my/companies', verifyToken, verifyRecruiter, async (req, res) => {
    const company = await companyCollection.findOne({ recruiterId: req.user._id.toString() });
    res.send(company || {});
});

app.post('/api/companies', verifyToken, verifyRecruiter, async (req, res) => {
    const recruiterId = req.user._id.toString();

    const existing = await companyCollection.findOne({ recruiterId });
    if (existing) {
        return res.status(409).send({ message: 'You have already registered a company' });
    }
    if (!req.body?.name) {
        return res.status(400).send({ message: 'Company name is required' });
    }

    const newCompany = {
        ...pick(req.body, ['name', 'websiteUrl', 'industry', 'location', 'employeeCount', 'description', 'logo']),
        recruiterId,
        recruiterEmail: req.user.email,
        status: 'Pending', // only an admin can approve
        createdAt: new Date(),
    };

    const result = await companyCollection.insertOne(newCompany);
    res.send(result);
});

app.patch('/api/companies/:id', verifyToken, async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) {
        return res.status(400).send({ message: 'Invalid company id' });
    }

    // Admin: change approval status only
    if (req.user.role === 'admin') {
        const { status } = req.body || {};
        if (!COMPANY_STATUSES.includes(status)) {
            return res.status(400).send({ message: 'Invalid status' });
        }
        const result = await companyCollection.updateOne({ _id: id }, { $set: { status } });
        return res.send(result);
    }

    // Recruiter: edit own company details 
    if (req.user.role === 'recruiter') {
        const updates = pick(req.body, [
            'name',
            'websiteUrl',
            'industry',
            'location',
            'employeeCount',
            'description',
            'logo',
        ]);
        const result = await companyCollection.updateOne(
            { _id: id, recruiterId: req.user._id.toString() },
            { $set: { ...updates, updatedAt: new Date() } }
        );
        if (result.matchedCount === 0) {
            return res.status(403).send({ message: 'forbidden access' });
        }
        return res.send(result);
    }

    res.status(403).send({ message: 'forbidden access' });
});

// Plans & subscriptions 
app.get('/api/plans', async (req, res) => {
    const query = {};
    if (req.query.plan_id) {
        query.id = String(req.query.plan_id);
    }
    const plan = await planCollection.findOne(query);
    res.send(plan);
});


app.post('/api/subscriptions', verifyInternal, async (req, res) => {
    const { userId, planId, sessionId, amount, currency } = req.body || {};

    if (!PAID_PLAN_IDS.includes(planId) || !sessionId) {
        return res.status(400).send({ message: 'Invalid subscription data' });
    }

    const userObjectId = toObjectId(userId);
    const user = userObjectId ? await usersCollection.findOne({ _id: userObjectId }) : null;
    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }

    // seeker_* plans are for seekers, recruiter_* plans are for recruiters
    if (planId.split('_')[0] !== user.role) {
        return res.status(400).send({ message: 'This plan does not match the account type' });
    }

    try {
        await subscriptionCollection.insertOne({
            userId: user._id.toString(),
            email: user.email,
            planId,
            sessionId,
            amount: Number(amount) || 0,
            currency: currency || 'usd',
            status: 'paid',
            createdAt: new Date(),
        });
    } catch (error) {
        if (error.code === 11000) {
            
            return res.send({ alreadyProcessed: true });
        }
        throw error;
    }

    const result = await usersCollection.updateOne({ _id: user._id }, { $set: { plan: planId } });
    res.send(result);
});


// Errors

app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).send({ message: 'Internal server error' });
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
    console.log(`Localhost Link: http://localhost:${port}`);
});