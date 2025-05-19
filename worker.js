// import { Worker } from 'bullmq';
// import { QdrantVectorStore } from '@langchain/qdrant';
// import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
// import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
// import { TaskType } from "@google/generative-ai";
// import 'dotenv/config'


// // Set your API key
// const worker = new Worker(
//   'file-upload-queue',
//   async (job) => {

//     console.log(`Job:`, job.data);
//     const data = JSON.parse(job.data);

//     if (!data.path || typeof data.path !== 'string') {
//       throw new Error('Invalid or missing file path');
//     }

//     const loader = new PDFLoader(data.path);
//     const docs = await loader.load();

//     console.log(`Loaded ${docs.length} documents`);

//     // const embeddings = new OpenAIEmbeddings({
//     //   model: 'text-embedding-3-small',
//     //   apiKey: '',
//     // });
//     const embeddings = new GoogleGenerativeAIEmbeddings({
//       apiKey: process.env.GEMINI_API_KEY,
//       modelName: 'embedding-001',
//       taskType: TaskType.RETRIEVAL_DOCUMENT,
//       title: 'Uploaded Document',
//     });


//     const testVector = await embeddings.embedQuery("OK Google");
//     console.log(`✅ Embedding test vector length: ${testVector}`);

//     const vectorStore = await QdrantVectorStore.fromExistingCollection(
//       embeddings,
//       {
//         url: 'http://localhost:6333',
//         collectionName: 'langchainjs-testing',
//       }
//     );
    
//     await vectorStore.addDocuments(docs);
//     console.log(`All docs are added to vector store`);

    
//     await job.remove(); // Clean up job from Redis
//     console.log(`✅ Job ${job.id} removed from queue`);
//   },
//   {
//     concurrency: 100,
//     connection: {
//       host: 'localhost',
//       port: '6379',
//     },
//   }
// );
