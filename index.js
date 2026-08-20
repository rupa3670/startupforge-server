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
     const applicationsCollection = db.collection("applications")
    const usersCollection = client.db("test").collection("user");
    // const usersCollection = db.collection("user"); 
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
     app.get('/all-startup',async(req,res)=>{
        const result =await startupsCollection.find().toArray();
        res.send(result);
    });

    app.get('/my-startup', async(req,res)=>{
        const email = req.query.email;
        if(!email){
            return res.status(400).send({message:'Email is required'});
        }
        const result = await startupsCollection.findOne({founder_email:email});
        res.json(result);
    });

    app.post('/startup', async(req,res)=>{
    const startupData = req.body;
    const existing = await startupsCollection.findOne({founder_email: startupData.founder_email});
    if(existing){
        return res.status(409).send({message:'You already have a startup profile'});
    }
    const newStartup = { ...startupData, status:'pending', createdAt: new Date() };
    const result = await startupsCollection.insertOne(newStartup);
    res.status(201).send({success:true, message:'Startup created successfully!', insertedId: result.insertedId});
});

    app.patch('/startup/:id',async(req,res)=>{
        const id = req.params.id;
        const updatedData = req.body;
        delete updatedData._id;

        const result = await startupsCollection.updateOne(
            {_id:new ObjectId(id)},
            {$set:updatedData}
        );
        res.send(result);
    });
     app.delete('/startup/:id', async (req, res) => {
        const id = req.params.id;
        const result = await startupsCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
    });


      app.get('/opportunities',async(req,res)=>{
        const limit = parseInt(req.query.limit) || 6;
        const result = await opportunityCollection
        .find()
        .sort({createdAt:-1})
        .limit(limit)
        .toArray();
        res.send(result);
    })

 app.get('/all-opportunities',async(req,res)=>{
        const result =await opportunityCollection.find().toArray();
        res.send(result);
    });

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
//founder nijer email diye filter korbe
app.get('/my-opportunities', async(req,res)=>{
    const email = req.query.email;
    if(!email){
        return res.status(400).send({message:'Email query is required'})
    }
const result = await opportunityCollection
.find({founder_email:email})
.sort({createdAt:-1})
.toArray();
res.send(result);

});

//edit form er pre-fill korar jnno single opportunity
app.get('/opportunities/:id',async(req,res)=>{
    const id = req.params.id;
    const result = await opportunityCollection.findOne({
        _id: new ObjectId(id)})
res.send(result);
})

app.patch('/opportunities/:id',async(req,res)=>{
    const id = req.params.id;
    const updatedData = req.body;
    delete updatedData._id;
    const result = await opportunityCollection.updateOne
    ({_id:new ObjectId(id)},
    {$set:updatedData}
);
res.send(result);
});
app.delete('/opportunities/:id',async(req,res)=>{
    const id = req.params.id;
    const result = await opportunityCollection
    .deleteOne({_id:new ObjectId(id)});
    res.send(result);
});

app.get('/founder-applications',async(req,res)=>{
    const email = req.query.email;
    if(!email){
        return res.status(400).send({message:'Email query is required'});
    }
const opportunities = await opportunityCollection
.find ({founder_email:email})
.toArray();

const opportunityIds = opportunities.map((o)=>o._id)

const result = await applicationsCollection
.find({opportunity_id:{$in:opportunityIds}})
.sort({applied_at:-1})
.toArray();

const withRoleTitle = result.map((app)=>{
    const opp = opportunities.find(
        (o)=>o._id.toString()=== app.opportunity_id.toString()
    );
    return{...app,role_title:opp?.role_title || ''};
});
res.send(withRoleTitle)
})

app.post('/applications',async(req,res)=>{
    const applicationData=req.body;
    const opportunityId = new ObjectId(applicationData.opportunity_id);
    const existing = await applicationsCollection.findOne({
        opportunity_id:opportunityId,
        applicant_email:applicationData.applicant_email
    });
    if(existing){
        return res.status(409).send({message:'You have already to this opportunity'});
    }

    const newApplication={
        ...applicationData,
        opportunity_id:opportunityId,
        status:'Pending',
        applied_at:new Date(),
    };
    const result = await applicationsCollection.insertOne(newApplication);
    res.status(201).send({success:true,message:'Application submitted', insertedId:result.insertedId})
});
app.patch('/applications/:id/status', async (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    const result = await applicationsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
    );
    res.send(result);
});

app.get('/users/:email',async(req,res)=>{
    const email = req.params.email;
    const result = await usersCollection.findOne({email});
    if(!result){
        return res.status(404).send({message:'User not found'});
    }
res.send(result);
});

app.patch('/users/:email',async(req,res)=>{
    const email = req.params.email;
    const{name,image,bio} =req.body;

    const result = await usersCollection.updateOne(
        {email},
        {$set:{name,image,bio}}
    );
    res.send(result);
})

app.get('/my-application',async(req,res)=>{
    const email = req.query.email;
    if(!email)
    {
        return res.status(400).send({message:'Email query is required'});
    }
const applications = await applicationsCollection
.find({applicant_email:email})
.sort({applied_at:-1})
.toArray();

const opportunityIds = applications.map((a)=>
    a.opportunity_id);
const opportunities = await opportunityCollection
.find({_id:{$in:opportunityIds}})
.toArray();

const withDetails = applications.map((app)=>{
    const opp =  opportunities.find((o)=>o._id.toString()===app.opportunity_id.toString());
    return{
        ...app,
        role_title:opp?.role_title || '',
        startup_name: opp?.startup_name || '',
    };
});
res.send(withDetails);
})
   


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
