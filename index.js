import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Queue } from 'bullmq';
import fs from 'fs';
const fsPromises = fs.promises;
import path from 'path';
import { QdrantVectorStore } from '@langchain/qdrant';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config'
import { rateLimit } from 'express-rate-limit'
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { fileURLToPath } from 'url';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,

  // Custom response when rate limit is exceeded
  handler: (req, res, next, options) => {
    res.status(429).json({
      error: 'Too many requests, please try again after a minute.',
    });
  },
});



/** Open AI client */
// const client = new OpenAI({
//   apiKey: '',
// });
// const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/** Queue config */
// const queue = new Queue('file-upload-queue', {
//   connection: {
//     host: 'localhost',
//     port: '6379',
//   },
// });
// const uploadsDir = path.join(__dirname, 'uploads');

const uploadPath = '/tmp/uploads';


if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true },err => {
    if (err) {
      console.error('Error creating uploads directory:', err);
    } else {
      console.log('📁 uploads folder created');
    }
  });
}

/** Multer config */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = uuidv4();
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });


app.use(cors({
  origin: [
    'http://localhost:8000',
    "https://rag-pdf-frontend-gray.vercel.app"
  ],
}));
app.use(limiter)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get('/', (req, res) => {
  return res.json({ status: 'All Good!' });
});

async function cleanUploads(uploadsDir) {
  try {
    const files = await fsPromises.readdir(uploadsDir);
    await Promise.all(
      files.map(file => fsPromises.unlink(path.join(uploadsDir, file)))
    );
    console.log('All files deleted');
  } catch (err) {
    console.error('Error deleting files:', err);
  }
}
app.post('/upload/pdf', upload.single('pdf'), async (req, res) => {
  try {
    console.log('🔥 Starting upload process');



    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = req.file.originalname;
    const destination = req.file.destination;
    const filePath = req.file.path;

    console.log(`File Name: ${filename}`)
    console.log(`Destination: ${destination}`)
    console.log(`Path: ${filePath}`)
    // await queue.add(
    //   'file-ready',
    //   JSON.stringify({
    //     filename: req.file.originalname,
    //     destination: req.file.destination,
    //     path: req.file.path,
    //   })
    // );

    const loader = new PDFLoader(filePath);
    const docs = await loader.load();

    console.log(`Loaded ${docs.length} documents`);

    // const embeddings = new OpenAIEmbeddings({
    //   model: 'text-embedding-3-small',
    //   apiKey: '',
    // });
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      modelName: 'embedding-001',
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      title: 'Uploaded Document',
    });


    const testVector = await embeddings.embedQuery("OK Google");
    // console.log(`✅ Embedding test vector length: ${testVector}`);

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: process.env.QUADRANT_END_POINT,
        collectionName: 'langchainjs-testing',
        apiKey: process.env.QUADRANT_API_KEY
      }
    );


    await vectorStore.addDocuments(docs);
    console.log(`All docs are added to vector store!`);
    await cleanUploads(uploadPath)

    return res.json({ message: 'uploaded' });
  } catch (e) {
    console.log(e)
    return res.json({ message: e.message })
  }
});


app.get('/chat', async (req, res) => {
  try {

    const userQuery = req.query.message;
    console.log(userQuery);

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      modelName: 'embedding-001',
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      title: 'Uploaded Document',
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: process.env.QUADRANT_END_POINT,
        collectionName: 'langchainjs-testing',
        apiKey: process.env.QUADRANT_API_KEY
      }
    );

    const ret = vectorStore.asRetriever({
      k: 2,
    });

    const result = await ret.invoke(userQuery);

    const SYSTEM_PROMPT = `
  You are helfull AI Assistant who answeres the user query based on the available context from PDF File.
  Context:
  ${JSON.stringify(result)}
  `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const output = await model.generateContent(`${SYSTEM_PROMPT}\n Answer this question according to context: ${userQuery}`);

    console.log(output.response.text());




    return res.json({
      message: output.response.text(),
    });
  }
  catch (e) {
    console.log(e)
    return res.json({ error: e.message })
  }
});


app.listen(3000, () => console.log(`Server started on PORT:${3000}`));





