import { readFile, writeFile } from 'fs/promises';

import cheerio from 'cheerio';

import { format } from './format';
import { walk } from './walk';

async function run() {
   const excessAttributes = ['inkscape:export-xdpi', 'inkscape:export-ydpi', 'sodipodi:absref'] as const;
   const attributeOrder = ['id', 'x', 'y', 'width', 'height', 'viewBox'];

   for await (const svg of walk('src', /\.svg$/)) {
      const $ = cheerio.load(await readFile(svg), { xml: true, decodeEntities: false });

      // untranslate
      for (const group of $('g[transform]')) {
         const translateMatch = /^translate\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/.exec(
            group.attribs['transform'],
         );

         if (!translateMatch) {
            continue;
         }

         const x = parseFloat(translateMatch[1]);
         const y = parseFloat(translateMatch[2]);

         for (const positional of $('[x][y]', group)) {
            positional.attribs['x'] = `${parseFloat(positional.attribs['x']) + x}`;
            positional.attribs['y'] = `${parseFloat(positional.attribs['y']) + y}`;
         }

         delete group.attribs['transform'];
      }

      // remove unwanted attributes + sort attributes
      for (const element of $('*')) {
         for (const attribute of excessAttributes) {
            delete element.attribs[attribute];
         }

         element.attribs = Object.fromEntries(
            Object.entries(element.attribs).sort(([a], [b]) => {
               if (a === 'style') {
                  return 1;
               }

               if (b === 'style') {
                  return -1;
               }

               if (attributeOrder.includes(a) && attributeOrder.includes(b)) {
                  return attributeOrder.indexOf(a) - attributeOrder.indexOf(b);
               }

               if (attributeOrder.includes(a)) {
                  return -1;
               }

               if (attributeOrder.includes(b)) {
                  return 1;
               }

               return a.localeCompare(b, 'en');
            }),
         );
      }

      // normalize image coordinates
      for (const image of $('image')) {
         image.attribs['x'] = `${Math.round(parseFloat(image.attribs['x']))}`;
         image.attribs['y'] = `${Math.round(parseFloat(image.attribs['y']))}`;
      }

      await writeFile(svg, format($.html()));
   }
}

run();
