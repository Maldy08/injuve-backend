const { MongoClient } = require('mongodb');

let db;

async function conectarMongo() {
  const client = new MongoClient(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  await client.connect();
  db = client.db(process.env.DB_NAME);
  console.log("🔗 Conectado a MongoDB:", process.env.DB_NAME);
}

function getDb() {
  if (!db) {
    throw new Error("❌ No se ha establecido conexión con la base de datos.");
  }
  return db;
}

module.exports = conectarMongo;
module.exports.getDb = getDb;
