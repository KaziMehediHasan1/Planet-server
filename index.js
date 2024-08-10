const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware..
app.use(cors());
app.use(express.json());

// PlanetSite
// sISMWDi7UlumUujP
const uri =
  "mongodb+srv://PlanetSite:sISMWDi7UlumUujP@cluster0.nfp7rpr.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const database = client.db("planet");
    const articlesCollection = database.collection("articles");
    const UsersCollection = database.collection("users");
    const PublisherCollection = database.collection("publisher");
    const PlanCollection = database.collection("plan");
    const PaymentCollection = database.collection("payment");

    // jwt token..
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "5h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // verify admin..
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded;

      // const query = { email: email };
      const user = await UsersCollection.findOne(query);
      const isAdmin = user?.email === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // all articles..
    app.post("/articles", async (req, res) => {
      const article = req.body;
      const result = await articlesCollection.insertOne(article);
      res.send(result);
    });

    // read articles data from database..
    app.get("/articles", async (req, res) => {
      const articles = req.body;
      const result = await articlesCollection.find(articles).toArray();
      res.send(result);
    });

    // delete articles from dashboard..
    app.delete("/articles/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await articlesCollection.deleteOne(filter);
      res.send(result);
    });

    //admin update approved articles(dashboard).
    app.patch("/articles/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const email = req.decoded?.email;
      const user = await UsersCollection.findOne({ email: email });

      const isAdmin = user?.role === "admin";

      let updateStatus;
      if (isAdmin) {
        updateStatus = {
          $set: {
            status: "Approved",
          },
        };
      } else {
        updateStatus = {
          $set: {
            premium: "isPremium",
          },
        };
      }
      const result = await articlesCollection.updateOne(query, updateStatus);
      res.send(result);
    });

    // user update userArticle isPremium (MyArticle).
    app.put("/viewCount/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateStatus = {
        $inc: { viewCount: 1 },
      };
      const result = await articlesCollection.updateOne(query, updateStatus);
      res.send(result);
    });

    // Publisher related api..
    app.post("/publisher", async (req, res) => {
      const publisher = req.body;
      const result = await PublisherCollection.insertOne(publisher);
      res.send(result);
    });

    // get publisher data..
    app.get("/publisher", async (req, res) => {
      const publisher = req.body;
      const result = await PublisherCollection.find(publisher).toArray();
      res.send(result);
    });
    // Users related
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await UsersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await UsersCollection.insertOne(user);
      res.send(result);
    });

    // get all user in dashboard panel..!
    app.get("/users", verifyToken, async (req, res) => {
      const user = req.body;
      const result = await UsersCollection.find(user).toArray();
      res.send(result);
    });

    // Delete user From dashboard..

    app.delete("/users/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await UsersCollection.deleteOne(filter);
      res.send(result);
    });

    // get admin...!
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded?.email) {
        return res.status(403).send({ message: "forbidden access" });
      } else {
        const query = { email: email };
        const user = await UsersCollection.findOne(query);
        let admin = false;

        if (user) {
          admin = user?.role === "admin";
        }
        res.send({ admin });
      }
    });

    // user admin..
    app.patch("/users/admin/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateRole = {
        $set: {
          role: "admin",
        },
      };
      const result = await UsersCollection.updateOne(query, updateRole);
      res.send(result);
    });

    // subscription plan..
    app.get("/plan", async (req, res) => {
      const subscription = req.body;
      const result = await PlanCollection.find(subscription).toArray();
      res.send(result);
    });

    // integrate payment system..
    app.post("/create-payment-intent", async (req, res) => {
      const { prices } = req.body;

      const amount = parseInt(prices * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment related api..
    app.post("/payment", verifyToken, async (req, res) => {
      const payment = req.body;
      const paymentResult = await PaymentCollection.insertOne(payment);
      res.send(paymentResult);
    });

    // get actual user payment..
    app.get("/payment", async (req, res) => {
      const data = req.body;
      const result = await PaymentCollection.find(data).toArray();
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 })
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Planet Server is running");
});

app.listen(port, () => {
  console.log(`planet server is running,${port}`);
});
