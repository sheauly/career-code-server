const express = require('express')
const cors = require('cors')
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config()
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const logger = (req, res, next) => {
    console.log('inside the logger middleware');
    next();
}

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}

const verifyFirebaseToken = (req, res, next) => {
    const authHeader = req.headers?.authorization;
    const token = authHeader.split('')[1];
    if (token) { return } {
        return res.status(401).send({message: 'unauthorized access'})
    }
    console.log('fb token', token)
}

// const verifyToken = (req, res, next) => {
//     const token = req?.cookies.token;
//     console.log('cookie in the middleware', req.cookies)
//     if (!token) {
//         return res.status(401).send({ message: 'unauthorized access' })
//     }
//     // verify token
//     jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
//         if (err) {
//             return res.status(401).send({message: 'unathorized access'})
//         }
//         req.decoded = decoded;
//         next();
//     })

// }
// careerDB
// poENzKYeCbVtrmfB

//jobs api

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@clustersheauly.6uz8dzi.mongodb.net/?retryWrites=true&w=majority&appName=ClusterSheauly`;

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

        const jobsCollection = client.db('careerCodeDB').collection('jobs');
        const applicationsCollection = client.db('careerCode').collection('application');


        // jwt token related api
        app.post('/jwt', async (req, res) => {
            const userInfo = req.body;

            const token = jwt.sign(userInfo, process.env.JWT_ACCESS_SECRET, { expiresIn: '2h' });

            res.cookie('token', token, {
                httpOnly: true,
                secure: false
            })

            res.send({ success: true })
        })

        // jobs api
        app.get('/jobs', async (req, res) => {
            const email = req.query.email;
            const query = {};
            if (email) {
                query.hr_email = email;

            }
            const cursor = jobsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });


        app.get('/applications/job/:job_id', async (req, res) => {
            const job_id = req.params.job_id;
            const query = { jobId: job_id }
            const result = await applicationsCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await jobsCollection.findOne(query);
            res.send(result);
        });

        app.get('/jobs/applications', verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { hr_email: email };
            const jobs = await jobsCollection.find(query).toArray();

            // should use aggregate to have optimum data featching

            for (const job of jobs) {
                const applicationQuery = { jobId: job._id.toString() }
                const application_count = await applicationsCollection.countDocuments(applicationQuery)
                job.application_count = application_count;
            }
        })

        app.post('/jobs', async (req, res) => {
            const newJob = req.body;
            console.log(newJob);
            const result = await jobsCollection.insertOne(newJob);
            res.send(result);
        })

        // job application related apis
        app.get('/applications', logger, verifyFirebaseToken, async (req, res) => {
            const email = req.query.email;
            // console.log('inside application api', req.cookies);


            const query = {
                application: email
            }
            const result = await applicationsCollection.find(query).toArray();

            // bad way aggreate data
            for (const application of result) {
                const jobId = application.jobId;
                const jobQuery = { _id: new ObjectId(jobId) }
                const job = await jobsCollection.findOne(jobQuery);
                application.company = job.company;
                application.title = job.title
                application.company_logo = job.company_logo
            }
            res.send(result);
        })

        app.post('/applications', async (req, res) => {
            const application = req.body;
            console.log(application)
            const result = await applicationsCollection.insertOne(application);
            res.send(result);
        })

        app.patch('/applications/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: req.body.status
                }
            }
            const result = await applicationsCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {

        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Career Code Cooking')
})

app.listen(port, () => {
    console.log(`Career Code Server is running on port ${port}`)
})
