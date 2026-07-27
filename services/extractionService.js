// ─────────────────────────────────────────────────────────────────────────────
// Extraction service — turns a datasheet text + a set of target submodel
// templates into a filled AAS instance draft, via the provider-agnostic
// llmService.
//
// Strategy: instead of mirroring arbitrary (possibly deep/recursive) templates
// as a JSON Schema — which hits structured-output limits — we ask the model for
//   • shell-level metadata (idShort, globalAssetId, description, assetKind)
//   • a FLAT list of { path, value, confidence, evidence } entries, where path
//     is "<SubmodelIdShort>.<dotted idShort path>"
// and then map the flat list back onto clones of the templates. The schema is
// fixed and works under both Claude and OpenAI strict json_schema.
// ─────────────────────────────────────────────────────────────────────────────

/** Recursively collect leaf field specs (dotted paths) for one template. */
function flattenTemplate(elements, prefix = '') {
  const specs = [];
  for (const el of elements || []) {
    if (!el || !el.idShort) continue;
    const path = prefix ? `${prefix}.${el.idShort}` : el.idShort;
    const children = Array.isArray(el.children) ? el.children : [];
    // Only Submodel­Element­Collections are treated as containers to descend
    // into. Lists (variable cardinality) and everything else are leaves.
    if (el.type === 'SubmodelElementCollection' && children.length) {
      specs.push(...flattenTemplate(children, path));
    } else {
      specs.push({
        path,
        type: el.type,
        valueType: el.valueType,
        required: !!el.required,
        legalRef: el.legalRef,
        description: el.description,
      });
    }
  }
  return specs;
}

/** Flatten every template, prefixing paths with the submodel idShort. */
function flattenTemplates(templates) {
  const specs = [];
  for (const tpl of templates) {
    specs.push(...flattenTemplate(tpl.elements, tpl.idShort));
  }
  return specs;
}

/** Fixed JSON Schema for the AAS-level extraction result (strict-safe). */
function buildSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['shell', 'fields'],
    properties: {
      shell: {
        type: 'object',
        additionalProperties: false,
        required: ['idShort', 'assetId', 'description', 'assetKind'],
        properties: {
          idShort: {
            type: 'string',
            description: 'Short product/asset name in UpperCamelCase without spaces (e.g. CentrifugalPump_CP200). "" if not determinable',
          },
          assetId: {
            type: 'string',
            description: 'Global asset id as URN, built from manufacturer/product/serial when present (e.g. urn:mfr:acme:pump:cp200:sn-1234). "" if not determinable',
          },
          description: { type: 'string', description: 'One-sentence product description. "" if not determinable' },
          assetKind: {
            type: 'string',
            enum: ['Instance', 'Type'],
            description: '"Instance" if the document refers to a specific serialized unit, otherwise "Type"',
          },
        },
      },
      fields: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['path', 'value', 'confidence', 'evidence'],
          properties: {
            path: { type: 'string', description: 'Dotted path "<SubmodelIdShort>.<element path>" of the target field' },
            value: { type: 'string', description: 'Extracted value ("" if not found)' },
            confidence: { type: 'number', description: 'Confidence 0..1' },
            evidence: { type: 'string', description: 'Short quote from the datasheet supporting the value' },
          },
        },
      },
    },
  };
}

/** Build the system + user prompt for the given templates and datasheet text. */
function buildPrompt(templates, specs, text) {
  const fieldLines = specs
    .map((s) => {
      const t = s.valueType ? `${s.type}, ${s.valueType}` : s.type;
      const req = s.required ? ' [required]' : '';
      const ref = s.legalRef ? ` — ${s.legalRef}` : '';
      return `- ${s.path} (${t})${req}${ref}`;
    })
    .join('\n');

  const smLines = templates
    .map((tpl) => `- ${tpl.idShort} (${tpl.semanticId})`)
    .join('\n');

  const system =
    'You extract an Asset Administration Shell (AAS) instance from a product datasheet: ' +
    'shell metadata plus field values for a fixed set of submodels. ' +
    'Use only information present in the document — never invent or infer values that are not stated. ' +
    'For each field return the value exactly as found (normalized to the field type), a confidence in [0,1], ' +
    'and a short evidence snippet quoting the source text. Omit fields you cannot find.';

  const prompt =
    `Target submodels:\n${smLines}\n\n` +
    `Fields to extract (dotted path "<SubmodelIdShort>.<element path>", type, optional legal reference):\n${fieldLines}\n\n` +
    `Datasheet text:\n"""\n${(text || '').slice(0, 60000)}\n"""\n\n` +
    'Fill the shell metadata from the document and return one fields entry per field you can fill; ' +
    'each path must match exactly one of the paths above.';

  return { system, prompt };
}

/** Index a template's elements by dotted idShort path (SEC recursion only). */
function indexByPath(elements, prefix = '', map = new Map()) {
  for (const el of elements || []) {
    if (!el || !el.idShort) continue;
    const path = prefix ? `${prefix}.${el.idShort}` : el.idShort;
    map.set(path, el);
    if (el.type === 'SubmodelElementCollection' && Array.isArray(el.children)) {
      indexByPath(el.children, path, map);
    }
  }
  return map;
}

/**
 * Clone each template and set values from the model's flat field list
 * (paths prefixed with the submodel idShort). Returns the filled clones.
 */
function applyFields(templates, fields) {
  const list = Array.isArray(fields) ? fields : [];
  return templates.map((tpl) => {
    const clone = JSON.parse(JSON.stringify(tpl));
    const index = indexByPath(clone.elements);
    const prefix = `${tpl.idShort}.`;
    for (const f of list) {
      if (!f || typeof f.path !== 'string' || typeof f.value !== 'string' || f.value === '') continue;
      if (!f.path.startsWith(prefix)) continue;
      const el = index.get(f.path.slice(prefix.length));
      if (!el) continue;
      el.value = el.type === 'MultiLanguageProperty' ? { en: f.value } : f.value;
    }
    return clone;
  });
}

module.exports = { flattenTemplate, flattenTemplates, buildSchema, buildPrompt, applyFields };
