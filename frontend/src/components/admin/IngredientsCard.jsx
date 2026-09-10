import { helpTextStyle, inputStyle, labelStyle, panelStyle } from './editorStyles.js';

export default function IngredientsCard({ form, onChange, disabled = false }) {
  return (
    <section style={panelStyle}>
      <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Ingredients</h2>
      <p style={{ ...helpTextStyle, marginTop: 0 }}>
        Paste the complete INCI list. This raw list is saved with the product and used later by Product Intelligence.
      </p>
      <label style={{ ...labelStyle, marginTop: 16 }}>
        Complete Ingredient List
        <textarea
          style={{ ...inputStyle, minHeight: 240, resize: 'vertical', lineHeight: 1.6, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
          value={form.ingredients}
          disabled={disabled}
          placeholder="Aqua, Glycerin, Niacinamide, Propanediol, Zinc PCA, Sodium Hyaluronate, Panthenol, Phenoxyethanol..."
          onChange={(event) => onChange({ ...form, ingredients: event.target.value, ingredientsTouched: true })}
        />
        <span style={helpTextStyle}>
          Separate ingredients with commas or new lines.
          {form.ingredientSource ? ` Source: ${form.ingredientSource}` : ''}
        </span>
      </label>
      <label style={{ ...labelStyle, marginTop: 16 }}>
        Key Ingredients
        <textarea
          style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
          value={form.keyIngredients}
          disabled={disabled}
          placeholder="Niacinamide, Zinc PCA"
          onChange={(event) => onChange({ ...form, keyIngredients: event.target.value })}
        />
      </label>
    </section>
  );
}
