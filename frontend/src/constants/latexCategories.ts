import type { LatexCategory } from '../types.ts';

export const latexCategories: LatexCategory[] = [
  { id: 'all', name: 'Все символы', icon: '📚' },
  { id: 'fraction', name: 'Дроби', icon: '½' },
  { id: 'root', name: 'Корни', icon: '√' },
  { id: 'superscript', name: 'Степени', icon: 'x²' },
  { id: 'subscript', name: 'Индексы', icon: 'x₁' },
  { id: 'brackets', name: 'Скобки', icon: '[]' },
  { id: 'operators', name: 'Операторы', icon: '∑' },
  { id: 'symbols', name: 'Символы', icon: 'α' },
];