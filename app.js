const express = require('express');
const path = require('path');
const { trace } = require('@opentelemetry/api');
const { DynamoDBClient, CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const app = express();
const PORT = 3000;
const tracer = trace.getTracer('phone-store-tracer');

// --- DynamoDB Configuration ---
const dbClient = new DynamoDBClient({
  region: "local",
  endpoint: process.env.DYNAMO_ENDPOINT || "http://localhost:8000",
  credentials: { accessKeyId: "fakeMyKeyId", secretAccessKey: "fakeSecretAccessKey" } 
});
const docClient = DynamoDBDocumentClient.from(dbClient);
const TABLE_NAME = "Phones";

// --- MIDDLEWARE (The Missing Lines!) ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Database Initialization ---
async function initializeDatabase() {
  let retries = 5;
  
  while (retries > 0) {
    try {
      // 1. Try to Create Table
      await dbClient.send(new CreateTableCommand({
        TableName: TABLE_NAME,
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        AttributeDefinitions: [{ AttributeName: "id", AttributeType: "N" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      }));
      console.log(`[LOG] Created DynamoDB table: ${TABLE_NAME}`);

      // 2. Seed Initial Data
      const seedData = [
        { id: 1, brand: 'Google', model: 'Pixel 8 Pro', price: 999, stock: 5 },
        { id: 2, brand: 'Apple', model: 'iPhone 15 Pro', price: 1099, stock: 3 },
        { id: 3, brand: 'Samsung', model: 'Galaxy S24 Ultra', price: 1299, stock: 10 }
      ];
      
      for (const phone of seedData) {
        await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: phone }));
      }
      console.log('[LOG] Database seeded with phones.');
      return; // Success! Exit the loop.

    } catch (err) {
      if (err.name === 'ResourceInUseException') {
        console.log(`[LOG] Table ${TABLE_NAME} already exists.`);
        return; // Success! Exit the loop.
      } else {
        console.log(`[LOG] Waiting for DynamoDB to wake up... (${retries} retries left)`);
        retries -= 1;
        // Wait for 2 seconds before trying again
        await new Promise(res => setTimeout(res, 2000)); 
      }
    }
  }
  console.error("[ERROR] Failed to connect to DynamoDB after multiple attempts.");
}

// Route: Get all phones
app.get('/api/phones', async (req, res) => {
  try {
    const data = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    const sortedPhones = data.Items.sort((a, b) => a.id - b.id);
    res.json(sortedPhones);
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch phones' });
  }
});

// Route: Buy a phone
app.post('/api/buy/:id', async (req, res) => {
  return tracer.startActiveSpan('process-purchase', async (span) => {
    const phoneId = parseInt(req.params.id, 10);
    span.setAttribute('phone.id', phoneId);

    try {
      // 1. Fetch the phone
      const { Item: phone } = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { id: phoneId }
      }));

      if (!phone) {
        span.setAttribute('purchase.success', false);
        span.addEvent('Phone not found');
        span.end();
        return res.status(404).json({ error: 'Phone not found' });
      }

      if (phone.stock <= 0) {
        span.setAttribute('purchase.success', false);
        span.addEvent('Out of stock');
        span.end();
        return res.status(400).json({ error: 'Out of stock' });
      }

      // 2. Decrement the stock in DynamoDB
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id: phoneId },
        UpdateExpression: "set stock = stock - :val",
        ExpressionAttributeValues: { ":val": 1 }
      }));

      span.setAttribute('purchase.success', true);
      span.setAttribute('phone.brand', phone.brand);
      span.addEvent('Purchase saved to DynamoDB successfully');
      
      console.log(`[TraceID: ${span.spanContext().traceId}] [LOG] Purchased ${phone.brand} ${phone.model}.`);
      span.end();
      res.json({ message: 'Purchase successful!', phone: { ...phone, stock: phone.stock - 1 } });

    } catch (error) {
      span.recordException(error);
      span.setAttribute('purchase.success', false);
      span.end();
      res.status(500).json({ error: 'Transaction failed' });
    }
  });
});

// Start the server and initialize the DB
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await initializeDatabase();
});