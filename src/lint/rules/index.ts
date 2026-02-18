import type { LintRule } from '../../core/types.js';

import {
  descExists,
  descMinLength,
  descMaxLength,
  descActionVerb,
  descClarity,
  descUnique,
  descStatesPurpose,
  descIncludesUsageGuidance,
  descStatesLimitations,
  descHasExamples,
} from './descriptions.js';
import {
  schemaExists,
  schemaValid,
  schemaParamDesc,
  schemaRequired,
  schemaEnumBool,
  schemaNoAny,
  schemaDefaults,
  paramEnumDocumented,
  paramDefaultDocumented,
  schemaNotTooDeep,
  schemaNoExcessiveParams,
} from './schemas.js';
import { nameConvention, nameVerbNoun, nameUnique, namePrefix } from './naming.js';
import {
  openaiToolCount,
  openaiNameLength,
  openaiNamePattern,
  nameNotAmbiguous,
} from './compatibility.js';

export const allRules: LintRule[] = [
  // Description quality
  descExists,
  descMinLength,
  descMaxLength,
  descActionVerb,
  descClarity,
  descUnique,
  descStatesPurpose,
  descIncludesUsageGuidance,
  descStatesLimitations,
  descHasExamples,

  // Schema & parameter validation
  schemaExists,
  schemaValid,
  schemaParamDesc,
  schemaRequired,
  schemaEnumBool,
  schemaNoAny,
  schemaDefaults,
  paramEnumDocumented,
  paramDefaultDocumented,
  schemaNotTooDeep,
  schemaNoExcessiveParams,

  // Naming conventions
  nameConvention,
  nameVerbNoun,
  nameUnique,
  namePrefix,

  // Provider compatibility
  openaiToolCount,
  openaiNameLength,
  openaiNamePattern,
  nameNotAmbiguous,
];
