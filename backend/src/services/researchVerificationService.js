const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const extractYear = (value) => {
  const match = String(value || '').match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
};

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return { ok: false, status: response.status, data: null };
    }
    const data = await response.json();
    return { ok: true, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: error.message };
  } finally {
    clearTimeout(timeoutId);
  }
};

export const verifyPubMedId = async (pmid) => {
  const id = String(pmid || '').replace(/[^\d]/g, '');
  if (!id) {
    return { valid: false, reason: 'PMID is missing or invalid.' };
  }

  const result = await fetchJson(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${id}&retmode=json`
  );

  if (!result.ok || !result.data?.result?.[id]) {
    return { valid: false, reason: 'PMID could not be verified against PubMed.', pmid: id };
  }

  const record = result.data.result[id];
  return {
    valid: true,
    pmid: id,
    title: record.title || '',
    authors: (record.authors || []).map((author) => author.name).filter(Boolean),
    journal: record.fulljournalname || record.source || '',
    year: extractYear(record.pubdate),
    doi: record.elocationid?.startsWith('doi:') ? record.elocationid.replace(/^doi:/i, '') : '',
  };
};

export const verifyDoi = async (doi) => {
  const normalizedDoi = String(doi || '').trim().replace(/^https?:\/\/doi\.org\//i, '');
  if (!normalizedDoi) {
    return { valid: false, reason: 'DOI is missing or invalid.' };
  }

  const result = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(normalizedDoi)}`);
  if (!result.ok || !result.data?.message) {
    return { valid: false, reason: 'DOI could not be verified.', doi: normalizedDoi };
  }

  const message = result.data.message;
  const authors = (message.author || [])
    .map((author) => [author.given, author.family].filter(Boolean).join(' '))
    .filter(Boolean);

  return {
    valid: true,
    doi: normalizedDoi,
    title: message.title?.[0] || '',
    authors,
    journal: message['container-title']?.[0] || '',
    year: message.issued?.['date-parts']?.[0]?.[0] || null,
  };
};

export const verifyEvidenceCitation = async (evidence = {}) => {
  const issues = [];
  let pubmedResult = null;
  let doiResult = null;

  if (evidence.pmid) {
    pubmedResult = await verifyPubMedId(evidence.pmid);
    if (!pubmedResult.valid) issues.push(pubmedResult.reason);
  }

  if (evidence.doi) {
    doiResult = await verifyDoi(evidence.doi);
    if (!doiResult.valid) issues.push(doiResult.reason);
  }

  if (!evidence.pmid && !evidence.doi) {
    issues.push('At least one of PMID or DOI is required for verification.');
  }

  const verifiedSource = pubmedResult?.valid ? pubmedResult : doiResult?.valid ? doiResult : null;
  if (verifiedSource) {
    if (evidence.sourceTitle && normalizeText(evidence.sourceTitle) !== normalizeText(verifiedSource.title)) {
      issues.push('Source title does not match verified citation title.');
    }
    if (evidence.year && verifiedSource.year && Number(evidence.year) !== Number(verifiedSource.year)) {
      issues.push('Publication year does not match verified citation year.');
    }
    if (Array.isArray(evidence.authors) && evidence.authors.length && Array.isArray(verifiedSource.authors)) {
      const provided = evidence.authors.map(normalizeText);
      const overlap = verifiedSource.authors.some((author) => provided.includes(normalizeText(author)));
      if (!overlap) {
        issues.push('Authors do not match verified citation authors.');
      }
    }
  }

  const verificationStatus = issues.length ? 'pending_review' : 'verified';

  return {
    verificationStatus,
    issues,
    pubmedResult,
    doiResult,
    recommendedResearchStatus: issues.length ? 'pending_review' : 'verified',
  };
};

export default {
  verifyPubMedId,
  verifyDoi,
  verifyEvidenceCitation,
};
