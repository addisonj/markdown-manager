import * as enrichments from './enrichments'
import * as extractors from './extractors'

export const plugins = { ...enrichments, ...extractors }