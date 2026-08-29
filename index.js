const express = require('express')
require('dotenv').config()
const cors = require('cors')
const app = express()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

const JWKS = createRemoteJWKSet(
    new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`)
);

// ── Collections declared at top level so middleware & routes can see them ──
let startupsCollection;
let opportunityCollection;
let applicationsCollection;
let paymentsCollections;
let usersCollection;

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: "Unauthorized access" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Unauthorized access" });
    }
    jwtVerify(token, JWKS)
        .then((result) => {
            req.decoded = result.payload;
            next();
        })
        .catch((err) => {
            console.error("❌ JWT verify failed:", err.message, err.code); // এই লাইন যোগ করুন
            return res.status(401).json({ message: "Unauthorized access", debug: err.message }); // সাময়িকভাবে debug info পাঠান
        })
}
const verifyEmail = (req, res, next) => {
    if (req.params.email && req.decoded.email !== req.params.email) {
        return res.status(403).json({ message: "forbidden access" });
    }
    next();
};
const verifyFounder = async (req, res, next) => {
    const user = await usersCollection.findOne({ email: req.decoded.email });
    if (user?.role !== "founder") {
        return res.status(403).json({ message: "forbidden access" });
    }
    next();
};

const verifyCollaborator = async (req, res, next) => {
    const user = await usersCollection.findOne({ email: req.decoded.email });
    if (user?.role !== "collaborator") {
        return res.status(403).json({ message: "forbidden access" });
    }
    next();
};

const verifyAdmin = async (req, res, next) => {
    const user = await usersCollection.findOne({ email: req.decoded.email });
    if (user?.role !== 'admin') {
        return res.status(403).json({ message: "forbidden access" });
    }
    next();
};

app.use(cors());
app.use(express.json());
const uri = process.env.MONGODB_URL;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // await client.connect();
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const db = client.db("startupForge");
        console.log("Server file loaded fresh at:", new Date());
        console.log("Connected DB name:", db.databaseName);
        // ── assign to the top-level variables, no `const` here ──
        startupsCollection = db.collection("startup");
        opportunityCollection = db.collection("opportunities");
        applicationsCollection = db.collection("applications");
        paymentsCollections = db.collection("payments");
           usersCollection = client.db("test").collection("user");

        app.get('/startup', async (req, res) => {
            const limit = parseInt(req.query.limit) || 6;
            const result = await startupsCollection
                .find()
                .sort({ createdAt: -1 })
                .limit(limit)
                .toArray();
            res.send(result);
        })
        app.get('/all-startup', async (req, res) => {
            const result = await startupsCollection.find().toArray();
            res.send(result);
        });

        app.get('/my-startup', verifyToken, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.status(400).send({ message: 'Email is required' });
            }
            const result = await startupsCollection.findOne({ founder_email: email });
            res.json(result);
        });

        app.post('/startup', verifyToken, verifyFounder, async (req, res) => {
            try {
                const startupData = req.body;
                const existing = await startupsCollection.findOne({ founder_email: startupData.founder_email });
                if (existing) {
                    return res.status(409).send({ message: 'You already have a startup profile' });
                }
                const newStartup = { ...startupData, status: 'pending', createdAt: new Date() };
                const result = await startupsCollection.insertOne(newStartup);
                res.status(201).send({ success: true, message: 'Startup created successfully!', insertedId: result.insertedId });
            } catch (err) {
                console.error('POST /startup error:', err);
                res.status(500).send({ message: err.message });
            }
        });

        app.patch('/startup/:id', verifyToken, verifyFounder, async (req, res) => {
            try {
                const id = req.params.id;
                const updatedData = req.body;
                delete updatedData._id;

                const result = await startupsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updatedData }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).send({ success: false, message: 'Startup not found' });
                }

                res.send({ success: true, message: 'Startup updated successfully!', modifiedCount: result.modifiedCount });
            } catch (err) {
                console.error('PATCH /startup/:id error:', err);
                res.status(500).send({ message: err.message });
            }
        });
        app.delete('/startup/:id', verifyToken, verifyFounder, async (req, res) => {
            const id = req.params.id;
            const result = await startupsCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });


        app.get('/opportunities', async (req, res) => {
            const limit = parseInt(req.query.limit) || 6;
            const result = await opportunityCollection
                .find()
                .sort({ createdAt: -1 })
                .limit(limit)
                .toArray();
            res.send(result);
        })

        app.get('/all-opportunities', async (req, res) => {
            const { search, workType, industry } = req.query;
            const limit = Number(req.query.limit) || 9;
            const page = Number(req.query.page) || 1;
            const skip = (page - 1) * limit;

            const query = {};

            if (search) {
                query.$or = [
                    { role_title: { $regex: search, $options: 'i' } },
                    { required_skills: { $regex: search, $options: 'i' } },
                ];
            }
            if (workType) {
                const workTypes = workType.split(',');
                query.work_type = { $in: workTypes };
            }
            if (industry) {
                const industries = industry.split(',');
                query.industry = { $in: industries };
            }

            const total_data = await opportunityCollection.countDocuments(query);

            const result = await opportunityCollection
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray();

            res.send({
                data: result,
                totalCount: total_data,
                totalPages: Math.ceil(total_data / limit),
                currentPage: page,
            });
        });



        app.post('/opportunities', verifyToken, verifyFounder, async (req, res) => {
            const opportunityData = req.body;

            const startup = await startupsCollection.findOne({ founder_email: opportunityData.founderEmail });

            if (!startup) {
                return res.status(404).send({ message: 'No startup found for this founder' });
            }

            const opportunityCount = await opportunityCollection.countDocuments({
                founder_email: opportunityData.founderEmail
            });

            if (opportunityCount >= 3) {
                const founder = await usersCollection.findOne({ email: opportunityData.founderEmail });
                if (!founder || founder.plan !== 'premium') {
                    return res.status(403).send({
                        message: 'Free limit reached.Upgrade to premium to post more opportunities.',
                        redirect: '/dashboard/founder/add-opportunities/pricing'
                    })
                }
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

        app.get('/my-opportunities', verifyToken, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.status(400).send({ message: 'Email query is required' })
            }
            const result = await opportunityCollection
                .find({ founder_email: email })
                .sort({ createdAt: -1 })
                .toArray();
            res.send(result);

        });


        app.get('/opportunities/:id', async (req, res) => {
            const id = req.params.id;
            const result = await opportunityCollection.findOne({
                _id: new ObjectId(id)
            })
            res.send(result);
        })

        app.patch('/opportunities/:id', verifyToken, verifyFounder, async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;
            delete updatedData._id;
            const result = await opportunityCollection.updateOne
                ({ _id: new ObjectId(id) },
                    { $set: updatedData }
                );
            res.send(result);
        });
        app.delete('/opportunities/:id', verifyToken, verifyFounder, async (req, res) => {
            const id = req.params.id;
            const result = await opportunityCollection
                .deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        app.get('/founder-applications', verifyToken, verifyFounder, async (req, res) => {

            const email = req.query.email;
            if (!email) {
                return res.status(400).send({ message: 'Email query is required' });
            }
            const opportunities = await opportunityCollection
                .find({ founder_email: email })
                .toArray();

            const opportunityIds = opportunities.map((o) => o._id)

            const result = await applicationsCollection
                .find({ opportunity_id: { $in: opportunityIds } })
                .sort({ applied_at: -1 })
                .toArray();

            const withRoleTitle = result.map((app) => {
                const opp = opportunities.find(
                    (o) => o._id.toString() === app.opportunity_id.toString()
                );
                return { ...app, role_title: opp?.role_title || '' };
            });
            res.send(withRoleTitle)
        })


        app.get('/founder-overview', verifyToken, verifyFounder, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                return res.status(400).send({ message: 'Email query is required' });
            }

            const opportunities = await opportunityCollection.find({ founder_email: email }).toArray();

            const opportunityIds = opportunities.map(o => o._id);

            const totalOpportunities = opportunities.length;

            const totalApplications = await applicationsCollection.countDocuments({
                opportunity_id: { $in: opportunityIds }
            });
            const acceptMembers = await applicationsCollection.countDocuments({
                opportunity_id: { $in: opportunityIds },
                status: "accepted"
            });

            res.send({
                opportunities: totalOpportunities,
                applications: totalApplications,
                accepted: acceptMembers
            });
        })

        app.post('/applications', verifyToken, verifyCollaborator, async (req, res) => {
            const applicationData = req.body;
            const opportunityId = new ObjectId(applicationData.opportunity_id);
            const existing = await applicationsCollection.findOne({
                opportunity_id: opportunityId,
                applicant_email: req.decoded.email
            });
            if (existing) {
                return res.status(409).send({ message: 'You have already to this opportunity' });
            }

            const newApplication = {
                ...applicationData,
                opportunity_id: opportunityId,
                applicant_email: req.decoded.email,
                status: 'pending',
                applied_at: new Date(),
            };
            const result = await applicationsCollection.insertOne(newApplication);
            res.status(201).send({ success: true, message: 'Application submitted', insertedId: result.insertedId })
        });
        app.patch('/applications/:id/status', verifyToken, verifyFounder, async (req, res) => {
            const id = req.params.id;
            const { status } = req.body;
            const result = await applicationsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status: status.toLowerCase() } }
            );
            res.send(result);
        });

        app.get('/user/:email', verifyToken, verifyEmail, async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.findOne({ email });
            if (!result) {
                return res.status(404).send({ message: 'User not found' });
            }
            res.send(result);
        });

        app.patch('/user/:email', verifyToken, verifyEmail, async (req, res) => {
            const email = req.params.email;
            const { name, image, bio } = req.body;

            const result = await usersCollection.updateOne(
                { email },
                { $set: { name, image, bio } }
            );
            res.send(result);
        })

        app.get('/my-application', verifyToken, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.status(400).send({ message: 'Email query is required' });
            }
            const applications = await applicationsCollection
                .find({ applicant_email: email })
                .sort({ applied_at: -1 })
                .toArray();

            const opportunityIds = applications.map((a) =>
                a.opportunity_id);
            const opportunities = await opportunityCollection
                .find({ _id: { $in: opportunityIds } })
                .toArray();

            const withDetails = applications.map((app) => {
                const opp = opportunities.find((o) => o._id.toString() === app.opportunity_id.toString());
                return {
                    ...app,
                    role_title: opp?.role_title || '',
                    startup_name: opp?.startup_name || '',
                };
            });
            res.send(withDetails);
        })

        app.get('/collaborator-overview', verifyToken, verifyCollaborator, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.status(400).send({ message: 'Email query is required' });
            }
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const totalApplications = await applicationsCollection.countDocuments({
                applicant_email: email
            });
            const acceptedApplications = await applicationsCollection.countDocuments({
                applicant_email: email,
                status: 'accepted'
            });
            const pendingApplications = await applicationsCollection.countDocuments({
                applicant_email: email,
                status: 'pending'
            });

            res.send({
                totalApplications,
                accepted: acceptedApplications,
                pending: pendingApplications,
            });
        });

        app.get('/admin/overview', verifyToken, verifyAdmin, async (req, res) => {
            const totalUsers = await usersCollection.countDocuments();
            const totalStartups = await startupsCollection.countDocuments();
            const totalOpportunities = await opportunityCollection.countDocuments();

            const revenueResult = await paymentsCollections.aggregate([
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]).toArray();
            const totalRevenue = revenueResult[0]?.total || 0;

            res.send({ totalUsers, totalStartups, totalOpportunities, totalRevenue });
        });

        app.post('/user', verifyToken, verifyEmail, async (req, res) => {
            const userData = req.body;
            const existing = await usersCollection.findOne({ email: userData.email });
            if (existing) {
                return res.send({ message: 'User already exists', insertedId: null });
            }
            const newUser = { ...userData, isBlocked: false, createdAt: new Date() };
            const result = await usersCollection.insertOne(newUser);
            res.status(201).send(result);
        });

        app.get('/all-users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        app.get('/debug/dbcheck', async (req, res) => {
    const count = await usersCollection.countDocuments();
    const sample = await usersCollection.find().limit(5).toArray();
    res.json({
        namespace: usersCollection.namespace,
        totalUsers: count,
        sampleUsers: sample
    });
});

        app.patch('/user/:email/block', verifyToken, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.updateOne(
                { email },
                { $set: { isBlocked: true } }
            );
            res.send(result);
        });

        app.patch('/user/:email/unblock', verifyToken, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.updateOne(
                { email },
                { $set: { isBlocked: false } }
            );
            res.send(result);
        });

        app.get('/admin/startups', verifyToken, verifyAdmin, async (req, res) => {
            const result = await startupsCollection.find().toArray();
            res.send(result);
        });

        app.patch('/admin/startups/:id/approve', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const result = await startupsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status: 'approved' } }
            );
            res.send(result);
        });

        app.delete('/admin/startups/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const result = await startupsCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        })

        app.get('/admin/transactions', verifyToken, verifyAdmin, async (req, res) => {
            const result = await paymentsCollections.find().sort({ paid_at: -1 }).toArray();
            res.send(result);
        });


        app.post('/payments', async (req, res) => {
            const { transaction_id, amount, payment_status, founder_email } = req.body;

            if (!founder_email) {
                return res.status(400).send({ message: 'founder_email is required' });
            }

            const existing = await paymentsCollections.findOne({ transaction_id });
            if (existing) {
                return res.send({ message: 'already recorded', payment: existing });
            }

            const paymentRecord = {
                user_email: founder_email,
                amount,
                transaction_id,
                payment_status,
                paid_at: new Date(),
            };
            await paymentsCollections.insertOne(paymentRecord);
            await usersCollection.updateOne(
                { email: founder_email },
                { $set: { plan: 'premium' } }
            );

            res.status(201).send({ success: true, payment: paymentRecord });
        });



    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);
app.get('/', (req, res) => {
    res.send('StartupForge server is running');
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
})