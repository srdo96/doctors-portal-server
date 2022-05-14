const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient } = require("mongodb");

const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tiz3z.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri);

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

    // services API
    app.get("/services", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    /**
     * API Naming Convention
     *
     * app.get('/booking') //get all booking in this collection. or more than one or by filter
     * app.get('/booking/:id') //get a specific booking
     * app.post('/booking') //add a new booking
     * app.patch('/booking/:id') // update a specific one
     * app.delete('/booking/:id')
     */

    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        service: booking.service,
        date: booking.date,
        patient: booking.patient,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log("Listening to port -> ", port);
});
