/**
 * DataViews, in a module of its own. It is the editor's biggest package and
 * only the lists under Advanced, Posts, all pages and the menu picker use it,
 * so the screens import this module the first time they show one rather
 * than each bundling a copy. See `src/use-dataviews.js`.
 */
export {
	DataViews,
	DataViewsPicker,
	filterSortAndPaginate,
} from '@wordpress/dataviews';
