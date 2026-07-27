const path = require('path');
const pdfParse = require('pdf-parse');
const llmService = require('../services/llmService');
const extractionService = require('../services/extractionService');
const loggerService = require('../services/loggerService');

module.exports = {
  /**
   * POST /v1/extract
   * Multipart: `file` (PDF datasheet) + `templates` (JSON array di SubmodelTemplate target).
   * Estrae dal PDF, con il provider LLM configurato, una bozza di instance AAS:
   * { shell: { idShort, assetId, description, assetKind },
   *   submodels: [template compilati], fields: [{path, value, confidence, evidence}],
   *   provider, pages }.
   */
  extract: async function (req, res) {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ status: 'Failure', message: 'File PDF mancante (campo "file")' });
      }
      let templates;
      try {
        templates = JSON.parse(req.body.templates);
      } catch {
        return res.status(400).json({ status: 'Failure', message: 'Campo "templates" mancante o non è JSON valido' });
      }
      if (!Array.isArray(templates) || templates.length === 0) {
        return res.status(400).json({ status: 'Failure', message: '"templates" deve essere un array non vuoto' });
      }
      for (const tpl of templates) {
        if (!tpl?.idShort || !Array.isArray(tpl.elements)) {
          return res.status(400).json({ status: 'Failure', message: 'Template non valido: servono idShort ed elements' });
        }
      }

      const parsed = await pdfParse(req.file.buffer);
      const text = (parsed.text || '').trim();
      if (!text) {
        return res.status(422).json({
          status: 'Failure',
          message: 'Il PDF non contiene testo estraibile (scansione? OCR non ancora supportato)',
        });
      }

      const specs = extractionService.flattenTemplates(templates);
      if (!specs.length) {
        return res.status(400).json({ status: 'Failure', message: 'I template non hanno campi da estrarre' });
      }

      const { system, prompt } = extractionService.buildPrompt(templates, specs, text);
      const result = await llmService.extractStructured({
        system,
        prompt,
        schema: extractionService.buildSchema(),
        schemaName: 'aas_instance_extraction',
      });

      const submodels = extractionService.applyFields(templates, result.fields);
      return res.status(200).json({
        status: 'Success',
        data: {
          shell: result.shell || { idShort: '', assetId: '', description: '', assetKind: 'Instance' },
          submodels,
          fields: result.fields || [],
          provider: llmService.getProvider(),
          pages: parsed.numpages,
        },
      });
    } catch (err) {
      loggerService.printError(path.basename(__filename), 'extract', [], err.message);
      return res.status(502).json({ status: 'Failure', message: `Estrazione non riuscita: ${err.message}` });
    }
  },
};
