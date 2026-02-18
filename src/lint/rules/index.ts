import type { LintRule } from '../../core/types.js';

import { descExists, descMinLength, descMaxLength, descActionVerb, descClarity, descUnique } from './descriptions.js';
import { schemaExists, schemaValid, schemaParamDesc, schemaRequired, schemaEnumBool, schemaNoAny, schemaDefaults } from './schemas.js';
import { nameConvention, nameVerbNoun, nameUnique, namePrefix } from './naming.js';
import { errorContent, errorTypes } from './errors.js';

export const allRules: LintRule[] = [
  // Descriptions
  descExists,
  descMinLength,
  descMaxLength,
  descActionVerb,
  descClarity,
  descUnique,

  // Schemas
  schemaExists,
  schemaValid,
  schemaParamDesc,
  schemaRequired,
  schemaEnumBool,
  schemaNoAny,
  schemaDefaults,

  // Naming
  nameConvention,
  nameVerbNoun,
  nameUnique,
  namePrefix,

  // Error handling (placeholders — needs bench data)
  errorContent,
  errorTypes,
];
