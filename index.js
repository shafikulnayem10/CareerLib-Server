require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD 
    }
});

// Verify email configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('Email configuration error:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

// Welcome email template
const getWelcomeEmailTemplate = (userName, userEmail) => {
    return {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: 'Welcome to CareerLib! 🎉',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to CareerLib</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        line-height: 1.6;
                        color: #1a1a1a;
                        background-color: #f8f9fa;
                        margin: 0;
                        padding: 0;
                    }
                    .container {
                        max-width: 600px;
                        margin: 40px auto;
                        padding: 30px;
                        background-color: #ffffff;
                        border-radius: 12px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .header {
                        text-align: center;
                        padding-bottom: 20px;
                        border-bottom: 2px solid #f0f0f0;
                    }
                    .header h1 {
                        color: #2563eb;
                        font-size: 28px;
                        margin: 0;
                    }
                    .content {
                        padding: 30px 0;
                    }
                    .welcome-message {
                        font-size: 18px;
                        color: #1a1a1a;
                        margin-bottom: 20px;
                    }
                    .features {
                        background-color: #f8fafc;
                        padding: 20px;
                        border-radius: 8px;
                        margin: 25px 0;
                    }
                    .features ul {
                        list-style-type: none;
                        padding: 0;
                        margin: 0;
                    }
                    .features li {
                        padding: 8px 0;
                        padding-left: 25px;
                        position: relative;
                    }
                    .features li:before {
                        content: "✓";
                        position: absolute;
                        left: 0;
                        color: #2563eb;
                        font-weight: bold;
                    }
                    .cta-button {
                        display: inline-block;
                        background-color: #2563eb;
                        color: white;
                        padding: 12px 30px;
                        text-decoration: none;
                        border-radius: 8px;
                        font-weight: 600;
                        margin-top: 20px;
                        transition: background-color 0.2s;
                    }
                    .cta-button:hover {
                        background-color: #1d4ed8;
                    }
                    .footer {
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        text-align: center;
                        color: #6b7280;
                        font-size: 14px;
                    }
                    .social-links {
                        margin: 15px 0;
                    }
                    .social-links a {
                        color: #6b7280;
                        text-decoration: none;
                        margin: 0 10px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚀 Welcome to CareerLib!</h1>
                    </div>
                    <div class="content">
                        <div class="welcome-message">
                            <p>Hi ${userName || 'there'}! 👋</p>
                            <p>We're thrilled to have you join the CareerLib community. Your journey to finding the perfect job or the ideal candidate starts now!</p>
                        </div>

                        <div class="features">
                            <h3 style="margin-top: 0; color: #1a1a1a;">What you can do with CareerLib:</h3>
                            <ul>
                                <li>Browse thousands of job opportunities</li>
                                <li>Connect with top companies and recruiters</li>
                                <li>Track your applications and interviews</li>
                                <li>Get personalized job recommendations</li>
                                <li>Build your professional network</li>
                            </ul>
                        </div>

                        <div style="text-align: center;">
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="cta-button">
                                Get Started Now
                            </a>
                        </div>

                        <div style="margin-top: 25px; padding: 15px; background-color: #f0f9ff; border-radius: 8px; border-left: 4px solid #2563eb;">
                            <p style="margin: 0; color: #1e293b; font-size: 15px;">
                                <strong>💡 Pro Tip:</strong> Complete your profile to get matched with the best opportunities!
                            </p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Need help? Contact us at <a href="mailto:support@CareerLib.com" style="color: #2563eb; text-decoration: none;">support@CareerLib.com</a></p>
                        <p style="font-size: 13px;">This email was sent to ${userEmail}</p>
                        <p style="font-size: 12px; color: #9ca3af;">© ${new Date().getFullYear()} CareerLib. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };
};

// Function to send welcome email
const sendWelcomeEmail = async (userEmail, userName) => {
    try {
        const mailOptions = getWelcomeEmailTemplate(userName, userEmail);
        const info = await transporter.sendMail(mailOptions);
        console.log('Welcome email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending welcome email:', error);
        return { success: false, error: error.message };
    }
};

const logger = (req, res, next) => {
    console.log('logger middleware logged', req.params);
    next();
}

app.get('/', (req, res) => {
    res.send('I am CareerLib backend!');
});

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        const database = client.db(process.env.AUTH_DB_NAME);
        
        // Define collections
        const jobCollection = database.collection("jobs");
        const companyCollection = database.collection("companies");
        const usersCollection = database.collection("user");
        const applicationsCollection = database.collection("applications");
        const planCollection = database.collection('plans');
        const subscriptionCollection = database.collection('subscriptions');
        const sessionCollection = database.collection('session');
        
        // Verification related
        const verifyToken = async (req, res, next) => {
            const authHeader = req.headers?.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = authHeader.split(' ')[1]
            if (!token) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const query = { token: token }
            const session = await sessionCollection.findOne(query);
            if (!session) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const userId = session.userId;
            const userQuery = { _id: userId }
            const user = await usersCollection.findOne(userQuery);
            if (!user) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            req.user = user;
            next();
        }

        const verifySeeker = async (req, res, next) => {
            if (req.user?.role !== 'seeker') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        const verifyRecruiter = async (req, res, next) => {
            if (req.user?.role !== 'recruiter') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        const verifyAdmin = async (req, res, next) => {
            if (req.user.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        // NEW: User registration endpoint with welcome email
        app.post('/api/auth/register', async (req, res) => {
            try {
                const { email, name, password, role } = req.body;
                
                // Check if user already exists
                const existingUser = await usersCollection.findOne({ email });
                if (existingUser) {
                    return res.status(400).send({ 
                        message: 'User already exists with this email' 
                    });
                }

                // Create new user 
                const newUser = {
                    email,
                    name: name || email.split('@')[0],
                    password, // In production, this should be hashed
                    role: role || 'seeker',
                    plan: 'free',
                    createdAt: new Date(),
                    isEmailVerified: false,
                    lastLogin: new Date()
                };

                const result = await usersCollection.insertOne(newUser);
                
                // Send welcome email
                const emailResult = await sendWelcomeEmail(email, newUser.name);
                
                if (emailResult.success) {
                    console.log(`Welcome email sent successfully to ${email}`);
                } else {
                    console.error(`Failed to send welcome email to ${email}:`, emailResult.error);
                }

                res.status(201).send({
                    success: true,
                    message: 'User registered successfully',
                    user: {
                        id: result.insertedId,
                        email: newUser.email,
                        name: newUser.name,
                        role: newUser.role
                    },
                    emailStatus: emailResult
                });

            } catch (error) {
                console.error('Registration error:', error);
                res.status(500).send({ 
                    success: false, 
                    message: 'Failed to register user',
                    error: error.message 
                });
            }
        });

        // Optional: Endpoint to resend welcome email
        app.post('/api/auth/resend-welcome', async (req, res) => {
            try {
                const { email } = req.body;
                const user = await usersCollection.findOne({ email });
                
                if (!user) {
                    return res.status(404).send({ 
                        success: false, 
                        message: 'User not found' 
                    });
                }

                const emailResult = await sendWelcomeEmail(email, user.name);
                
                res.send({
                    success: emailResult.success,
                    message: emailResult.success ? 'Welcome email resent successfully' : 'Failed to resend welcome email',
                    ...emailResult
                });

            } catch (error) {
                console.error('Resend email error:', error);
                res.status(500).send({ 
                    success: false, 
                    message: 'Failed to resend welcome email' 
                });
            }
        });

        // Jobs related APIs
        app.get('/api/jobs', async (req, res) => {
            console.log('server side q', req.query)
            const query = {};
            if (req.query.search) {
                query.$or = [
                    { jobTitle: { $regex: req.query.search, $options: 'i' } },
                    { companyName: { $regex: req.query.search, $options: 'i' } }
                ]
            }
            if (req.query.jobType) {
                query.jobType = req.query.jobType
            }
            if (req.query.jobCategory) {
                query.jobCategory = req.query.jobCategory
            }
            if (req.query.isRemote) {
                query.isRemote = req.query.isRemote
            }
            if (req.query.companyId) {
                query.companyId = req.query.companyId;
            }
            if (req.query.status) {
                query.status = req.query.status;
            }

            if (req.query.page) {
                const page = req.query.page;
                const perPage = req.query.perPage || 12;
                const skipItems = (page - 1) * perPage
                const total = await jobCollection.countDocuments(query);
                const cursor = jobCollection.find(query).skip(skipItems).limit(perPage);
                const jobs = await cursor.toArray();
                return res.send({ total, jobs });
            }

            const cursor = jobCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/api/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await jobCollection.findOne(query);
            res.send(result);
        })

        app.post('/api/jobs', async (req, res) => {
            const job = req.body;
            const newJob = { ...job, createdAt: new Date() }
            const result = await jobCollection.insertOne(newJob);
            res.send(result);
        })

        // Application related APIs
        app.get('/api/applications', verifyToken, verifySeeker, async (req, res) => {
            const query = {};
            if (req.query.applicantId) {
                query.applicantId = req.query.applicantId;
                if (req.user._id.toString() !== req.query.applicantId) {
                    return res.status(403).send({ message: 'forbidden access' })
                }
            }
            if (req.query.jobId) {
                query.jobId = req.query.jobId;
            }
            const cursor = applicationsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.post('/api/applications', async (req, res) => {
            const application = req.body;
            const newApplication = { ...application, createdAt: new Date() }
            const result = await applicationsCollection.insertOne(newApplication);
            res.send(result);
        })

        // Company related APIs
        app.get('/api/companies', verifyToken, verifyAdmin, async (req, res) => {
            const cursor = companyCollection.find();
            const companies = await cursor.toArray();
            for (const company of companies) {
                const filter = { companyId: company._id.toString() }
                const jobCount = await jobCollection.countDocuments(filter)
                company.jobCount = jobCount
            }
            res.send(companies);
        })

        app.get('/api/companies2', async (req, res) => {
            const pipeline = [
                { $skip: 5 },
                { $limit: 2 }
            ];
            const cursor = companyCollection.aggregate(pipeline);
            const result = await cursor.toArray();
            res.send(result)
        })

        app.get('/api/stats', async (req, res) => {
            const pipeline = [
                {
                    $group: {
                        _id: '$jobType',
                        count: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        jobType: '$_id',
                        _id: 0,
                        count: 1
                    }
                },
                {
                    $sort: { count: 1 }
                }
            ]
            const cursor = jobCollection.aggregate(pipeline);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/api/my/companies', async (req, res) => {
            const query = {};
            if (req.query.recruiterId) {
                query.recruiterId = req.query.recruiterId;
            }
            const result = await companyCollection.findOne(query);
            res.send(result || {});
        })

        app.post('/api/companies', async (req, res) => {
            const company = req.body;
            const newCompany = { ...company, createdAt: new Date() }
            const result = await companyCollection.insertOne(newCompany);
            res.send(result);
        })

        app.patch('/api/companies/:id', logger, verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updatedCompany = req.body;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: { status: updatedCompany.status }
            }
            const result = await companyCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // Plans
        app.get('/api/plans', async (req, res) => {
            const query = {}
            if (req.query.plan_id) {
                query.id = req.query.plan_id
            }
            const plan = await planCollection.findOne(query);
            res.send(plan)
        })

        // Subscription
        app.post('/api/subscriptions', async (req, res) => {
            const data = req.body;
            const subsInfo = { ...data, createdAt: new Date() }
            const result = await subscriptionCollection.insertOne(subsInfo);
            const filter = { email: data.email };
            const updateDocument = {
                $set: { plan: data.planId }
            };
            const updateResult = await usersCollection.updateOne(filter, updateDocument);
            res.send(updateResult)
        })

        // Verify the database connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

    } catch (error) {
        console.dir(error);
    }
}

run().catch(console.dir);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
    console.log(`Localhost Link: http://localhost:${port}`);
});