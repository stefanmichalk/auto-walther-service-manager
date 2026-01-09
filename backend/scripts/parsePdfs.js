import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pdfsDir = path.join(__dirname, '../../pdfs');
const outputDir = path.join(__dirname, '../../extracted');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function parsePdf(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  
  return {
    filename: path.basename(filePath),
    numpages: data.numpages,
    info: data.info,
    metadata: data.metadata,
    text: data.text,
    // Try to extract structured data
    lines: data.text.split('\n').filter(line => line.trim()),
  };
}

async function main() {
  const pdfFiles = fs.readdirSync(pdfsDir).filter(f => f.endsWith('.pdf'));
  
  console.log(`Found ${pdfFiles.length} PDF files\n`);
  
  for (const pdfFile of pdfFiles) {
    const filePath = path.join(pdfsDir, pdfFile);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Parsing: ${pdfFile}`);
    console.log('='.repeat(60));
    
    try {
      const result = await parsePdf(filePath);
      
      // Save JSON output
      const jsonPath = path.join(outputDir, `${path.basename(pdfFile, '.pdf')}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
      
      // Print summary
      console.log(`Pages: ${result.numpages}`);
      console.log(`Lines extracted: ${result.lines.length}`);
      console.log(`\n--- RAW TEXT (first 3000 chars) ---\n`);
      console.log(result.text.substring(0, 3000));
      console.log(`\n--- END ---\n`);
      
    } catch (error) {
      console.error(`Error parsing ${pdfFile}:`, error.message);
    }
  }
}

main();
