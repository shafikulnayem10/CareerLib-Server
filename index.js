require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require('mongodb');

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
        const jobCollection = database.collection("jobs");
        const companyCollection = database.collection("companies");
        const usersCollection = database.collection("users");

        // API endpoints start here
        
        app.get('/api/users', async (req, res) => {
            
            const cursor = usersCollection.find().skip(6);
            const result = await cursor.toArray();
            res.send(result);
        });
        // GET Jobs API
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
        // POST Job API
        app.post('/api/jobs', async (req, res) => {
            try {
                const job = req.body;
                const result = await jobCollection.insertOne(job);
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Error inserting job", error });
            }
        });
 

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

    } catch (error) {
        console.dir(error);
    } 
    // finally { await client.close(); }
}

run().catch(console.dir);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
    console.log(`Localhost Link: http://localhost:${port}`); 
});