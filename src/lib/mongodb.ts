
import { MongoClient, Db, ServerApiVersion, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env. It should start with "mongodb://" or "mongodb+srv://".'
  );
}

// Enhanced check for common placeholders to prevent EBADNAME errors and guide the user.
const placeholderPattern = /<[^>]+>/g; // Matches any string in angle brackets e.g. <username>
if (placeholderPattern.test(MONGODB_URI) || MONGODB_URI.includes('YOUR_CLUSTER_URL') || MONGODB_URI.includes('YOUR_DB_NAME') || MONGODB_URI.includes('YOUR_USERNAME') || MONGODB_URI.includes('YOUR_PASSWORD')) {
  console.error("ERROR: MONGODB_URI in your .env file appears to contain placeholder values (e.g., <username>, <password>, <cluster-url>, <dbname>, YOUR_USERNAME, etc.).");
  console.error("Please replace these placeholders with your actual MongoDB credentials and cluster information.");
  let maskedUri = MONGODB_URI;
  const placeholders = ['<username>', '<password>', 'YOUR_USERNAME', 'YOUR_PASSWORD'];
  placeholders.forEach(ph => {
    if (MONGODB_URI.includes(ph)) {
        maskedUri = maskedUri.replace(new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '****');
    }
  });
  console.error("Your current MONGODB_URI (partially masked for logging):", maskedUri);
  throw new Error(
    'MONGODB_URI contains placeholder values. Please update your .env file with actual credentials and ensure no placeholder bracketed values <> or "YOUR_..." strings remain.'
  );
}


if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
    throw new Error(
        'Invalid MONGODB_URI scheme. The connection string must start with "mongodb://" or "mongodb+srv://". Please check your .env file.'
    );
}

interface MongoConnection {
  client: MongoClient;
  db: Db;
}

// Global is used here to maintain a cached connection across hot reloads
// in development. This prevents connections from growing exponentially
// during API Route usage.
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<MongoConnection> {
  if (cachedClient && cachedDb) {
    // Ensure the client is still connected before returning cache
    try {
      // Ping the database to check connection status
      // Using admin command as it's lightweight and always available
      await cachedDb.admin().ping();
    } catch (error) {
      console.warn("Cached MongoDB connection lost, attempting to reconnect.", error);
      cachedClient = null;
      cachedDb = null;
      // Fall through to reconnect
    }
    if (cachedClient && cachedDb) {
        return { client: cachedClient, db: cachedDb };
    }
  }
  
  // Redundant check due to top-level, but good for safety within function scope
  if (!MONGODB_URI) { 
    throw new Error(
      'MONGODB_URI is not defined. Please set it in your .env file.'
    );
  }


  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  try {
    await client.connect();
    
    let dbName;
    try {
        // Attempt to parse the URI to find the database name
        const url = new URL(MONGODB_URI);
        // The database name is usually the first segment after the host in the pathname
        // e.g., mongodb+srv://user:pass@cluster.mongodb.net/MY_DATABASE?retryWrites=true
        // or mongodb://localhost:27017/MY_DATABASE
        const pathSegments = url.pathname.substring(1).split('/');
        dbName = pathSegments[0] || undefined; 

        if (!dbName && MONGODB_URI.startsWith('mongodb+srv://')) {
            // For SRV, if path is empty or just "/", db name might be in options or default.
            // MongoDB driver handles this, but good to be aware.
            console.warn(`Database name not explicitly found in MONGODB_URI path for SRV connection: ${url.pathname}. The driver will use the default database specified in your connection string options or 'test' if none is found. Ensure your SRV URI is complete, like 'mongodb+srv://user:pass@cluster/<dbname>?options'.`);
        } else if (!dbName) {
            console.warn(`Database name not found in MONGODB_URI path: ${url.pathname}. The driver may default to 'test'. Ensure your URI includes the database name, like 'mongodb://host/<dbname>'.`);
        }
    } catch (e: any) {
        console.error("Could not parse MONGODB_URI to extract database name. This might indicate a malformed URI. URI used (password and username masked for security):", MONGODB_URI.replace(/:\/\/([^:]+):([^@]+)@/, '://<user>:****@'));
        console.error("Parsing error details:", e.message);
        // If parsing fails, dbName will be undefined, and client.db() will use the default database
        // or one specified directly in the connection string options (if any).
    }

    const db = client.db(dbName); // If dbName is undefined, MongoDB driver typically uses 'test' or one specified in URI options.
    
    cachedClient = client;
    cachedDb = db;

    console.log("Successfully connected to MongoDB. Database being used: " + (db.databaseName));
    return { client, db };
  } catch (error: any) {
    console.error("Failed to connect to MongoDB. URI used (username/password masked):", MONGODB_URI.replace(/:\/\/([^:]+):([^@]+)@/, '://<user>:****@'));
    console.error("Connection Error Details:", error.message);
    if (error.message && error.message.includes('querySrv EBADNAME')) {
        console.error("This 'querySrv EBADNAME' error often means the cluster URL in your MONGODB_URI is incorrect or your DNS cannot resolve it. Double-check the <cluster-url> part of your SRV string.");
    } else if (error.message && error.message.includes('Authentication failed')) {
        console.error("MongoDB Authentication Failed: Please double-check your username and password in the MONGODB_URI.");
    } else if (error.message && error.message.includes('ECONNREFUSED')) {
        console.error("MongoDB Connection Refused: Ensure the MongoDB server is running and accessible from your application's environment. Check firewall rules and IP allowlists if applicable.");
    }
    if (client && typeof client.close === 'function') {
        try {
            await client.close();
        } catch (closeError) {
            console.error("Error closing MongoDB client after connection failure:", closeError);
        }
    }
    throw error; 
  }
}

export { ObjectId };
    
