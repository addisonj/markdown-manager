import * as enrichments from './enrichments/index.js'
import * as extractors from './extractors/index.js'

export const plugins = { ...enrichments, ...extractors }
