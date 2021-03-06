const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ObjectId } = require("mongodb");
var nodemailer = require("nodemailer");
var sgTransport = require("nodemailer-sendgrid-transport");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tiz3z.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri);

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res
        .status(403)
        .send({ message: "Invalid Token, Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

var emailSenderOptions = {
  auth: {
    api_key: process.env.EMAIL_SENDER_KEY,
  },
};

const emailClient = nodemailer.createTransport(sgTransport(emailSenderOptions));

function sendAppointmentEmail(booking) {
  const { patientEmail, patientName, service, date, slot } = booking;

  var email = {
    from: process.env.EMAIL_SENDER,
    to: patientEmail,
    subject: `Your appointment for ${service} is on ${date} at ${slot} is confirmed`,
    text: `Your appointment for ${service} is on ${date} at ${slot} is confirmed`,
    html: `
    <div>
    <p>Hello ${patientName},</p>
    <h3>Your appointment for ${service} is confirmed.</h3>
    <p>Looking forward to seeing you on ${date} at ${slot}.</p>

    <h3>Our Address</h3>
    <p>Mirpur-12, Dhaka</p>
    <p>Bangladesh</p>
    <a href="https://doctors-portal-f31ef.web.app/">Unsubscribe</a>
    </div>
    `,
  };

  emailClient.sendMail(email, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      console.log("Message sent: ", info);
    }
  });
}

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res
        .status(403)
        .send({ message: "Invalid Token, Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

var emailSenderOptions = {
  auth: {
    api_key: process.env.EMAIL_SENDER_KEY,
  },
};

function sendPaymentConfirmationEmail(booking) {
  const { patientEmail, patientName, service, date, slot } = booking;

  var email = {
    from: process.env.EMAIL_SENDER,
    to: patientEmail,
    subject: `We have received your payment for  ${service} is on ${date} at ${slot} is confirmed`,
    text: `Your payment for this appointment ${service} is on ${date} at ${slot} is confirmed`,
    html: `
    <div>
    <p>Hello ${patientName},</p>
    <h3> Thank you for your payment.</h3>
    <h3>We have received your payment.</h3>
    <p>Looking forward to seeing you on ${date} at ${slot}.</p>

    <h3>Our Address</h3>
    <p>Mirpur-12, Dhaka</p>
    <p>Bangladesh</p>
    <a href="https://doctors-portal-f31ef.web.app/">Unsubscribe</a>
    </div>
    `,
  };

  emailClient.sendMail(email, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      console.log("Message sent: ", info);
    }
  });
}

async function run() {
  try {
    await client.connect();

    // service collection
    const serviceCollection = client
      .db("doctors_portal")
      .collection("services");

    // booking collection
    const bookingCollection = client
      .db("doctors_portal")
      .collection("bookings");

    // users collection
    const userCollection = client.db("doctors_portal").collection("users");
    // doctors collection
    const doctorCollection = client.db("doctors_portal").collection("doctors");
    const paymentCollection = client
      .db("doctors_portal")
      .collection("payments");

    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "Not Admin, Access Forbidden" });
      }
    };

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // services API
    app.get("/services", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query).project({ name: 1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/user", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);

      // to make ACCESS TOKEN from node -> require("crypto").randomBytes(64).toString("hex")
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    //Warning:
    // This is not the proper way to query
    //After learning more about mongodb. will use aggregate lookup, pipeline, match, group
    app.get("/available", async (req, res) => {
      const date = req.query.date || "May 14, 2022";

      // step 1: get all services
      const services = await serviceCollection.find().toArray();

      // step 2: get the booking of that day
      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();

      // step 3: foreach service, find bookings for the service
      services.forEach((service) => {
        const serviceBookings = bookings.filter(
          (b) => b.service === service.name
        );
        const booked = serviceBookings.map((s) => s.slot);
        const available = service.slots.filter((s) => !booked.includes(s));
        service.slots = available;
      });
      res.send(services);
    });

    /**
     * API Naming Convention
     *
     * app.get('/booking') //get all booking in this collection. or more than one or by filter
     * app.get('/booking/:id') //get a specific booking
     * app.post('/booking') //add a new booking
     * app.patch('/booking/:id') // update a specific one
     * app.put('/booking/:id') // upsert ==> update (if exists) or insert (if doesn't exist)
     * app.delete('/booking/:id')
     */

    app.get("/booking", verifyJWT, async (req, res) => {
      const patientEmail = req.query.patientEmail;
      const decodedEmail = req.decoded.email;
      if (decodedEmail === patientEmail) {
        const query = { patientEmail: patientEmail };
        const bookings = await bookingCollection.find(query).toArray();
        res.send(bookings);
      } else {
        return res.status(403).send({ message: "Forbidden Access" });
      }
    });

    app.get("/booking/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingCollection.findOne(query);
      res.send(booking);
    });

    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        service: booking.service,
        date: booking.date,
        patientEmail: booking.patientEmail,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      console.log("Sending email ...");
      sendAppointmentEmail(booking);
      return res.send({ success: true, result });
    });

    app.patch("/booking/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const query = { _id: ObjectId(id) };
      const updateDoc = {
        $set: { paid: true, transactionId: payment.transactionId },
      };
      const result = await paymentCollection.insertOne(payment);
      const updateBooking = await bookingCollection.updateOne(query, updateDoc);
      res.send(updateDoc);
    });

    app.get("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await doctorCollection.find().toArray();
      res.send(result);
    });

    app.post("/addDoctor", verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });

    app.delete("/doctor/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await doctorCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Welcome to Doctors portal server!");
});

app.listen(port, () => {
  console.log("Listening to port -> ", port);
});
