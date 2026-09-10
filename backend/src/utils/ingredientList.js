export const parseIngredientList = (value) => {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '');
  return [...new Set(
    raw
      .split(/[\n;,]+/)
      .map((entry) => entry.replace(/^[-*•]\s*/, '').replace(/^ingredients?:?\s*/i, '').trim())
      .filter((entry) => entry && !/^ingredients?:?$/i.test(entry))
  )];
};

export const formatIngredientList = (value) => parseIngredientList(value).join(', ');

export default {
  parseIngredientList,
  formatIngredientList,
};
