import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { panelStyle, buttonStyle, secondaryButtonStyle } from '../../components/admin/editorStyles.js';
import {
  approveIngredientResearch,
  editIngredientResearch,
  getIngredientKnowledge,
  getIngredientKnowledgeById,
  getResearchQueue,
  importIngredientKnowledge,
  rejectIngredientResearch,
  runIngredientResearch,
} from '../../api/adminApi.js';

const unwrapList = (response) => (Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []);

export default function AdminKnowledgePage() {
  const [tab, setTab] = useState('verified');
  const [records, setRecords] = useState([]);
  const [queue, setQueue] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [editDraft, setEditDraft] = useState(null);

  const load = async () => {
    try {
      const [knowledge, queueRes] = await Promise.all([
        getIngredientKnowledge({ search, limit: 200 }),
        getResearchQueue(),
      ]);
      setRecords(unwrapList(knowledge));
      setQueue(unwrapList(queueRes));
    } catch (error) {
      setMessage(error?.message || 'Unable to load knowledge base.');
    }
  };

  useEffect(() => { load(); }, []);

  const verified = records.filter((item) => item.researchStatus === 'verified');
  const visibleQueue = tab === 'queue' ? queue : queue.filter((item) => item.status === tab || tab === 'verified');

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>Science</div>
            <h1 style={{ margin: '6px 0 0' }}>Ingredient Knowledge</h1>
          </div>
          <button type="button" style={buttonStyle} onClick={async () => {
            try {
              const result = await importIngredientKnowledge();
              setMessage(`Imported ${result?.data?.inserted ?? result?.inserted ?? 0} new records; skipped ${result?.data?.skipped ?? result?.skipped ?? 0}.`);
              await load();
            } catch (error) {
              setMessage(error?.message || 'Import failed.');
            }
          }}>Import seed JSON</button>
        </div>

        {message ? <p style={{ padding: 12, background: '#f3f4f6', borderRadius: 8 }}>{message}</p> : null}

        <div style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}>
          {[
            { id: 'verified', label: 'Verified' },
            { id: 'queue', label: 'Research queue' },
            { id: 'research_needed', label: 'Unknown' },
            { id: 'pending_review', label: 'Pending review' },
          ].map((item) => (
            <button key={item.id} type="button" style={{ ...secondaryButtonStyle, background: tab === item.id ? '#111827' : '#fff', color: tab === item.id ? '#fff' : '#111827' }} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(0, 1.4fr)', gap: 20 }}>
          <section style={panelStyle}>
            <input value={search} onChange={(event) => setSearch(event.target.value)} onBlur={load} placeholder="Search ingredients" style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, border: '1px solid #d1d5db', marginBottom: 12 }} />
            <div style={{ display: 'grid', gap: 8, maxHeight: 640, overflow: 'auto' }}>
              {(tab === 'verified' ? verified.filter((item) => `${item.name} ${item.inciName} ${(item.synonyms || []).join(' ')}`.toLowerCase().includes(search.toLowerCase())) : visibleQueue).map((item) => (
                <button key={item._id} type="button" onClick={() => {
                  setSelected(item);
                  const proposed = item.proposedKnowledge || {};
                  setEditDraft(item.status === 'pending_review' ? {
                    scientificSummary: proposed.scientificSummary || '',
                    evidenceLevel: proposed.evidenceLevel || '',
                    generalFlag: proposed.generalFlag || '',
                    flagReason: proposed.flagReason || '',
                    uncertaintiesResearchGaps: proposed.uncertaintiesResearchGaps || '',
                  } : null);
                }} style={{ textAlign: 'left', padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', background: selected?._id === item._id ? '#111827' : '#fff', color: selected?._id === item._id ? '#fff' : '#111827' }}>
                  <div style={{ fontWeight: 700 }}>{item.name || item.ingredientName}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{item.researchStatus || item.status} {item.generalFlag ? `· ${item.generalFlag}` : ''}</div>
                </button>
              ))}
            </div>
          </section>

          <section style={panelStyle}>
            {!selected ? <p>Select an ingredient to inspect knowledge, sources, and research history.</p> : (
              <div style={{ display: 'grid', gap: 10, fontSize: 14 }}>
                <h2 style={{ marginTop: 0 }}>{selected.name || selected.ingredientName}</h2>
                <div>Status: {selected.researchStatus || selected.status}</div>
                {selected.inciName ? <div>INCI: {selected.inciName}</div> : null}
                {selected.evidenceLevel ? <div>Evidence: {selected.evidenceLevel}</div> : null}
                {selected.generalFlag ? <div>General flag: {selected.generalFlag}</div> : null}
                {selected.confidence != null ? <div>Confidence: {selected.confidence}</div> : null}
                {selected.scientificSummary ? <p>{selected.scientificSummary}</p> : null}
                {selected.proposedKnowledge?.scientificSummary ? <p>{selected.proposedKnowledge.scientificSummary}</p> : null}
                {selected.uncertaintiesResearchGaps ? <p><strong>Uncertainties:</strong> {selected.uncertaintiesResearchGaps}</p> : null}
                {selected.sources?.length ? (
                  <div>
                    <strong>Sources</strong>
                    <ul>{selected.sources.map((source, index) => <li key={index}>{source.title} {source.identifier}</li>)}</ul>
                  </div>
                ) : null}
                {selected.proposedKnowledge?.sources?.length ? (
                  <div>
                    <strong>Proposed sources</strong>
                    <ul>{selected.proposedKnowledge.sources.map((source, index) => <li key={index}>{source.title} {source.identifier}</li>)}</ul>
                  </div>
                ) : null}
                {selected.changeHistory?.length ? (
                  <div>
                    <strong>Change history</strong>
                    <ul>{selected.changeHistory.map((entry, index) => <li key={index}>v{entry.version}: {(entry.changedFields || []).join(', ') || 'update'} — {entry.reason}</li>)}</ul>
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selected.status === 'research_needed' || selected.status === 'failed' ? (
                    <button type="button" style={buttonStyle} onClick={async () => { await runIngredientResearch(selected._id); await load(); }}>Research</button>
                  ) : null}
                  {selected.status === 'pending_review' ? (
                    <>
                      {editDraft ? (
                        <div style={{ display: 'grid', gap: 8, width: '100%' }}>
                          <label>Evidence level
                            <input value={editDraft.evidenceLevel} onChange={(event) => setEditDraft({ ...editDraft, evidenceLevel: event.target.value })} style={{ width: '100%', padding: 8, marginTop: 4 }} />
                          </label>
                          <label>General flag
                            <input value={editDraft.generalFlag} onChange={(event) => setEditDraft({ ...editDraft, generalFlag: event.target.value })} style={{ width: '100%', padding: 8, marginTop: 4 }} />
                          </label>
                          <label>Flag reason
                            <textarea value={editDraft.flagReason} onChange={(event) => setEditDraft({ ...editDraft, flagReason: event.target.value })} rows={2} style={{ width: '100%', padding: 8, marginTop: 4 }} />
                          </label>
                          <label>Scientific summary
                            <textarea value={editDraft.scientificSummary} onChange={(event) => setEditDraft({ ...editDraft, scientificSummary: event.target.value })} rows={4} style={{ width: '100%', padding: 8, marginTop: 4 }} />
                          </label>
                          <label>Uncertainties
                            <textarea value={editDraft.uncertaintiesResearchGaps} onChange={(event) => setEditDraft({ ...editDraft, uncertaintiesResearchGaps: event.target.value })} rows={3} style={{ width: '100%', padding: 8, marginTop: 4 }} />
                          </label>
                          <button type="button" style={secondaryButtonStyle} onClick={async () => {
                            await editIngredientResearch(selected._id, { proposedKnowledge: editDraft });
                            setMessage('Proposed knowledge updated.');
                            await load();
                          }}>Save edits</button>
                        </div>
                      ) : null}
                      <button type="button" style={buttonStyle} onClick={async () => {
                        await approveIngredientResearch(selected._id, { edits: editDraft || {} });
                        setMessage('Approved and verified.');
                        await load();
                      }}>Approve</button>
                      <button type="button" style={{ ...buttonStyle, background: '#991b1b' }} onClick={async () => { await rejectIngredientResearch(selected._id, { reason: 'Rejected by admin' }); await load(); }}>Reject</button>
                    </>
                  ) : null}
                  {selected.researchStatus === 'verified' ? (
                    <button type="button" style={secondaryButtonStyle} onClick={async () => { const full = await getIngredientKnowledgeById(selected._id); setSelected(full?.data || full); }}>Refresh</button>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
