const express = require ('express')
require('dotenv').config()
const cors = require('cors')
const app= express()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
app.use(cors());
app.use(express.json());
const uri = process.env.MONGODB_URL;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

     const db = client.db("startupForge");
     const startupsCollection = db.collection("startup");
     const opportunityCollection = db.collection("opportunities")
    // console.log("DB name:", db.databaseName);
// const count = await startupsCollection.countDocuments();
// console.log("Total documents in collection:", count);

    app.get('/startup',async(req,res)=>{
        const limit = parseInt(req.query.limit) || 6;
        const result = await startupsCollection
        .find()
        .sort({createdAt:-1})
        .limit(limit)
        .toArray();
        res.send(result);
    })
      app.get('/opportunities',async(req,res)=>{
        const limit = parseInt(req.query.limit) || 6;
        const result = await opportunityCollection
        .find()
        .sort({createdAt:-1})
        .limit(limit)
        .toArray();
        res.send(result);
    })

    app.post('/opportunities', async (req, res) => {
    const opportunityData = req.body;

    const startup = await startupsCollection.findOne({ founder_email: opportunityData.founderEmail });
    if (!startup) {
        return res.status(404).send({ message: 'No startup found for this founder' });
    }

    const newOpportunity = {
        ...opportunityData,
        startup_id: new ObjectId(startup._id),
        startup_name: startup.startup_name,
        founder_email: opportunityData.founderEmail,
        createdAt: new Date(),
    };

    delete newOpportunity.founderEmail; 

    const result = await opportunityCollection.insertOne(newOpportunity);
    res.status(201).send({ success: true, message: "Opportunity added successfully!", insertedId: result.insertedId });
})

    app.get('/all-startup',async(req,res)=>{
        const result =await startupsCollection.find().toArray();
        res.send(result);
    });
    app.get('/all-opportunities',async(req,res)=>{
        const result =await opportunityCollection.find().toArray();
        res.send(result);
    });


  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.get('/',(req,res)=>{
    res.send('StartupForge server is running');
});

app.listen(port,()=>{
    console.log(`Example app listening on port ${port}`);
})
