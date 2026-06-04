require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


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
        const usersCollection = database.collection("users");

        //  USER ROUTES 

        // Retrieves a list of users, skipping the first 6 entries 
        app.get('/api/users', async (req, res) => {
            try {
                const cursor = usersCollection.find().skip(6);
                const result = await cursor.toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Error fetching users", error });
            }
        });

        //  JOB ROUTES 

        // Fetches jobs from the database with optional query filters (companyId, status)
        app.get('/api/jobs', async (req, res) => {
            try {
                const query = {};
                if (req.query.companyId) {
                    query.companyId = req.query.companyId;
                }
                if (req.query.status) {
                    query.status = req.query.status;
                }
                const cursor = jobCollection.find(query);
                const result = await cursor.toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Error fetching jobs", error });
            }
        });

        // Retrieves details for a specific job using its unique MongoDB ObjectId
        app.get('/api/jobs/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const result = await jobCollection.findOne(query);
                
                if (!result) {
                    return res.status(404).send({ message: "Job not found" });
                }
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Error fetching single job", error });
            }
        });

        // Handles submission of new job postings and writes them to the database
        app.post('/api/jobs', async (req, res) => {
            try {
                const job = req.body;
                const result = await jobCollection.insertOne(job);
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Error inserting job", error });
            }
        });

        //  COMPANY ROUTES 

        // Fetches registered companies while skipping the first 4 documents
        app.get('/api/companies', async (req, res) => {
            try {
                const cursor = companyCollection.find().skip(4);
                const result = await cursor.toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Error fetching companies", error });
            }
        });

        // Finds a single company profile matched to a specific recruiterId via query parameter
        app.get('/api/my/companies', async (req, res) => {
            try {
                const query = {};
                if (req.query.recruiterId) {
                    query.recruiterId = req.query.recruiterId;
                }
                const result = await companyCollection.findOne(query);
                res.send(result || {});
            } catch (error) {
                res.status(500).send({ message: "Error fetching recruiter company", error });
            }
        });

        // Creates a new company entry and automatically sets the current date as createdAt
        app.post('/api/companies', async (req, res) => {
            try {
                const company = req.body;
                const newCompany = {
                    ...company,
                    createdAt: new Date()
                };
                const result = await companyCollection.insertOne(newCompany);
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Error inserting company", error });
            }
        });

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