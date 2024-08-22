const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const { PDFDocument } = require('pdf-lib');

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    res.send('Hello, Im backend');
});

app.get('/fetch-pdf', async (req, res) => {
    const { url } = req.query;

    if (!url) {
      return res.status(400).send('URL parameter is required');
    }

    try {
      const response = await axios.get(url);
      const html = response.data;

      const $ = cheerio.load(html);
      const imageUrls = $('img')
        .map((i, img) => $(img).attr('src'))
        .get()
        .filter(src => src.includes('/sites/default/files/styles/worksheet/public/def_files/'))
        .map(src => src.startsWith('http') ? src : `https://www.liveworksheets.com${src}`);

      if (imageUrls.length === 0) {
        return res.status(404).send('No images found');
      }

      const pdfDoc = await PDFDocument.create();
      for (const imgUrl of imageUrls) {
        const imgResponse = await axios.get(imgUrl, { responseType: 'arraybuffer' });
        const imgData = imgResponse.data;
        const img = await pdfDoc.embedJpg(imgData);
        const { width, height } = img.scale(1);
        const page = pdfDoc.addPage([width, height]);
        page.drawImage(img, {
          x: 0,
          y: 0,
          width,
          height,
        });
      }
      const pdfBytes = await pdfDoc.save();

      res.setHeader('Content-Disposition', 'attachment; filename=worksheet.pdf');
      res.setHeader('Content-Type', 'application/pdf');
      res.send(Buffer.from(pdfBytes));

    } catch (error) {
      console.error('Error processing URL:', error);
      res.status(500).send('Error processing URL');
    }
});
module.exports = app;
