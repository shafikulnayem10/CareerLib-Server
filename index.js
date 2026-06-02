require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require('mongodb');

app.get('/', (req, res) => {
    res.send('Hello World!');
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

        // API endpoints start here
 

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

    } catch (error) {
        console.dir(error);
    } 
    // finally { await client.close(); } <-- এই ব্লকটি মুছে দেওয়া হয়েছে
}

run().catch(console.dir);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
    console.log(`Localhost Link: http://localhost:${port}`); 
});