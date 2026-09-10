import { panelStyle, buttonStyle } from './ProductDataForm.jsx';

function IntelligenceInputSummary({ input }) {
  if (!input) return null;

  const rows = [
    ['Product', input.name],
    ['Brand', input.brand],
    ['Category', input.category],
    ['Description', input.description ? `${input.description.slice(0, 120)}${input.description.length > 120 ? '…' : ''}` : '—'],
    ['Ingredients', (input.ingredients || []).join(', ') || '—'],
    ['Key Ingredients', (input.keyIngredients || []).join(', ') || '—'],
    ['Skin Types', (input.skinTypes || []).join(', ') || '—'],
    ['Concerns', (input.concerns || []).join(', ') || '—'],
    ['Fragrance Free', input.fragranceFree === null ? 'Unknown' : String(input.fragranceFree)],
    ['Alcohol Free', input.alcoholFree === null ? 'Unknown' : String(input.alcoholFree)],
    ['Essential Oil Free', input.essentialOilFree === null ? 'Unknown' : String(input.essentialOilFree)],
    ['Pregnancy Friendly', input.pregnancyFriendly === null ? 'Unknown' : String(input.pregnancyFriendly)],
  ];

  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: '#6b7280' }}>
        Intelligence Input
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ fontSize: 13 }}>
            <strong>{label}:</strong> {value || '—'}
          </div>
        ))}
      </div>
    </div>
  );
}

function IntelligenceResult({ intelligence, metadata, qualityScore }) {
  if (!intelligence) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 12 }}>Generated Intelligence</div>
      <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
        <div><strong>Evidence confidence:</strong> {intelligence.evidenceConfidence ?? '—'}</div>
        <div><strong>Quality score:</strong> {qualityScore ?? '—'}</div>
        <div><strong>Explanation:</strong> {intelligence.explanation || '—'}</div>
        <div>
          <strong>Skin type compatibility:</strong>
          <pre style={{ margin: '6px 0 0', padding: 10, background: '#f3f4f6', borderRadius: 6, overflow: 'auto', fontSize: 12 }}>
            {JSON.stringify(intelligence.skinTypeCompatibility, null, 2)}
          </pre>
        </div>
        <div>
          <strong>Sensitivity suitability:</strong>
          <pre style={{ margin: '6px 0 0', padding: 10, background: '#f3f4f6', borderRadius: 6, overflow: 'auto', fontSize: 12 }}>
            {JSON.stringify(intelligence.sensitivitySuitability, null, 2)}
          </pre>
        </div>
        <div>
          <strong>Concern compatibility:</strong>
          <pre style={{ margin: '6px 0 0', padding: 10, background: '#f3f4f6', borderRadius: 6, overflow: 'auto', fontSize: 12 }}>
            {JSON.stringify(intelligence.concernCompatibility, null, 2)}
          </pre>
        </div>
        <div>
          <strong>Ingredient analysis:</strong>
          <pre style={{ margin: '6px 0 0', padding: 10, background: '#f3f4f6', borderRadius: 6, overflow: 'auto', fontSize: 12, maxHeight: 240 }}>
            {JSON.stringify(intelligence.ingredientAnalysis, null, 2)}
          </pre>
        </div>
        {metadata ? (
          <div style={{ marginTop: 8, padding: 12, background: '#eff6ff', borderRadius: 8, fontSize: 12 }}>
            <strong>Audit</strong>
            <div>Generated at: {metadata.generatedAt ? new Date(metadata.generatedAt).toLocaleString() : '—'}</div>
            <div>Intelligence version: {metadata.intelligenceVersion || '—'}</div>
            <div>Prompt version: {metadata.promptVersion || '—'}</div>
            <div>Knowledge base version: {metadata.knowledgeBaseVersion || '—'}</div>
            <div>Provider: {metadata.provider || '—'} / {metadata.model || '—'}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function IntelligencePanel({
  productId,
  intelligenceInput,
  productIntelligence,
  intelligenceMetadata,
  intelligenceStatus,
  qualityScore,
  onGenerate,
  onApprove,
  onReject,
  isGenerating: isGeneratingRequest = false,
  isApproving = false,
  disabled = false,
  disabledReason = null,
  knowledgeCoverage = null,
  generationJob = null,
  hasPersistedIntelligence = false,
  onResearchIngredient = null,
}) {
  const hasIntelligence = Boolean(productIntelligence?.explanation);
  
  // Use nullish coalescing to handle undefined/null properly
  const persistedStatus = intelligenceStatus ?? generationJob?.status ?? (hasIntelligence ? 'generated' : undefined);
  
  // Priority order: queued/generating > failed > approved > generated/completed > none
  const isQueued = persistedStatus === 'queued';
  const isGenerating = persistedStatus === 'generating' || isGeneratingRequest;
  const isFailed = persistedStatus === 'failed';
  const isApproved = persistedStatus === 'approved';
  const isBusy = isQueued || isGenerating;
  
  const hasGeneratedIntelligence = Boolean(
    hasIntelligence || 
    hasPersistedIntelligence || 
    ['generated', 'completed', 'approved'].includes(persistedStatus)
  );

  return (
    <section style={panelStyle}>
      <h2 style={{ marginTop: 0, fontSize: 20 }}>2. Product Intelligence</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginTop: 0 }}>
        Generate AI intelligence from the saved product data. Intelligence is independent of publishing.
      </p>

      {/* Status Section - Separate from Action */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Status</div>
        <div style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 600,
          background: isApproved ? '#dbeafe' : isFailed ? '#fef2f2' : hasGeneratedIntelligence ? '#dcfce7' : isBusy ? '#eff6ff' : '#fef3c7',
          color: isApproved ? '#1e40af' : isFailed ? '#991b1b' : hasGeneratedIntelligence ? '#166534' : isBusy ? '#1d4ed8' : '#92400e',
        }}>
          {isApproved ? 'Approved' : isFailed ? 'Generation Failed' : isQueued ? 'Queued' : isGenerating ? 'Generating' : hasGeneratedIntelligence ? 'Generated (pending approval)' : 'Not Generated'}
        </div>
        {hasIntelligence && intelligenceMetadata?.generatedAt ? (
          <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
            Generated at: {new Date(intelligenceMetadata.generatedAt).toLocaleString()}
          </div>
        ) : null}
        {qualityScore !== null && qualityScore !== undefined ? (
          <div style={{ marginTop: 4, fontSize: 13, color: '#6b7280' }}>
            Quality score: {qualityScore}
          </div>
        ) : null}
      </div>

      {/* Action Section - Always visible, separate from status and result */}
      <div style={{ 
        marginBottom: 16, 
        padding: 14, 
        background: '#f9fafb', 
        border: '1px solid #e5e7eb', 
        borderRadius: 8 
      }}>
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: '#6b7280' }}>
          Product Intelligence Action
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            style={{
              ...buttonStyle,
              opacity: disabled || isBusy ? 0.55 : 1,
              cursor: disabled || isBusy ? 'not-allowed' : 'pointer',
            }}
            disabled={disabled || isBusy}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (disabled || isBusy || !onGenerate) return;
              onGenerate();
            }}
          >
            {isBusy
              ? 'Generating Product Intelligence…'
              : isFailed
                ? 'Retry Product Intelligence'
                : hasGeneratedIntelligence
                  ? 'Re-run Product Intelligence'
                  : 'Run Product Intelligence'}
          </button>
          {hasIntelligence && !isApproved && onApprove ? (
            <button type="button" style={{ ...buttonStyle, background: '#1d4ed8' }} disabled={isApproving} onClick={onApprove}>
              {isApproving ? 'Approving…' : 'Approve Intelligence'}
            </button>
          ) : null}
          {hasIntelligence && !isApproved && onReject ? (
            <button type="button" style={{ ...buttonStyle, background: '#991b1b' }} onClick={onReject}>
              Reject
            </button>
          ) : null}
        </div>
      </div>

      {knowledgeCoverage ? (
        <div style={{ marginBottom: 16, padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Knowledge Base Coverage</div>
          <div style={{ fontSize: 14, marginBottom: 10 }}>
            {knowledgeCoverage.total || 0} ingredients · {knowledgeCoverage.matched || 0} matched · {knowledgeCoverage.unmatched || 0} require research
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {(knowledgeCoverage.known || []).map((item) => (
              <div key={`known-${item.query}`} style={{ fontSize: 13, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <strong>{item.query}</strong>
                <span>matched</span>
                <span>{item.researchStatus}</span>
                {item.evidenceLevel ? <span>Evidence {item.evidenceLevel}</span> : null}
                {item.generalFlag ? <span>{item.generalFlag}</span> : null}
              </div>
            ))}
            {(knowledgeCoverage.unknown || []).map((item) => (
              <div key={`unknown-${item.query}`} style={{ fontSize: 13, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <strong>{item.query}</strong>
                <span style={{ color: '#92400e' }}>unmatched · {item.researchStatus}</span>
                {onResearchIngredient ? (
                  <button type="button" style={{ ...buttonStyle, padding: '6px 10px', fontSize: 12 }} onClick={() => onResearchIngredient(item.query)}>
                    Research Ingredient
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {disabled && disabledReason ? (
        <p style={{ color: '#b45309', fontSize: 14, background: '#fffbeb', padding: 12, borderRadius: 8 }}>
          {disabledReason}
        </p>
      ) : null}

      {isFailed ? (
        <p style={{ color: '#991b1b', fontSize: 14, background: '#fef2f2', padding: 12, borderRadius: 8 }}>
          {generationJob?.error || 'Product intelligence generation failed. You can run it again.'}
        </p>
      ) : null}

      <IntelligenceInputSummary input={intelligenceInput} />

      <IntelligenceResult
        intelligence={productIntelligence}
        metadata={intelligenceMetadata}
        qualityScore={qualityScore}
      />
    </section>
  );
}

export function PublishPanel({
  product,
  onPublish,
  isPublishing = false,
  publishLabel = 'Publish Product',
}) {
  const hasIntelligence = Boolean(product?.productIntelligence?.explanation);
  const isApproved = product?.intelligenceStatus === 'approved';
  const isActive = product?.isActive;

  return (
    <section style={panelStyle}>
      <h2 style={{ marginTop: 0, fontSize: 20 }}>3. Publish</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginTop: 0 }}>
        Publishing activates the product in the catalog. Intelligence must be generated first.
      </p>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16, fontSize: 14 }}>
        <div><strong>Catalog status:</strong> {isActive ? 'Published (active)' : 'Draft (inactive)'}</div>
        <div><strong>Intelligence:</strong> {isApproved ? 'Approved' : hasIntelligence ? 'Pending approval' : 'Not generated'}</div>
      </div>

      {!hasIntelligence ? (
        <p style={{ color: '#b42318', fontSize: 14, background: '#fef2f2', padding: 12, borderRadius: 8 }}>
          Product intelligence has not been generated. Generate intelligence before publishing.
        </p>
      ) : !isApproved ? (
        <p style={{ color: '#b42318', fontSize: 14, background: '#fef2f2', padding: 12, borderRadius: 8 }}>
          Product intelligence must be approved before publishing.
        </p>
      ) : null}

      {isActive ? (
        <p style={{ color: '#166534', fontSize: 14, background: '#f0fdf4', padding: 12, borderRadius: 8 }}>
          This product is already published and active.
        </p>
      ) : (
        <button
          type="button"
          style={buttonStyle}
          disabled={!hasIntelligence || !isApproved || isPublishing}
          onClick={onPublish}
        >
          {isPublishing ? 'Publishing…' : publishLabel}
        </button>
      )}
    </section>
  );
}