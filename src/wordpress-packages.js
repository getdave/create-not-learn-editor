/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { Breadcrumbs, Page } from '@wordpress/admin-ui';
import { registerCoreBlocks } from '@wordpress/block-library';
import {
	createBlock,
	hasBlockSupport,
	parse as parseBlocks,
	serialize,
	store as blocksStore,
} from '@wordpress/blocks';
import {
	BlockEditorProvider,
	BlockList,
	BlockTitle,
	LinkControl,
	store as blockEditorStore,
	useBlockBindingsUtils,
	useBlockEditingMode,
} from '@wordpress/block-editor';
import {
	Button,
	CheckboxControl,
	DropdownMenu,
	Icon,
	MenuGroup,
	MenuItem,
	Modal,
	Notice,
	Popover,
	SelectControl,
	Spinner,
	TextControl,
	/* eslint-disable @wordpress/no-unsafe-wp-apis -- Matches the prototype's modal layout components. */
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
	/* eslint-enable @wordpress/no-unsafe-wp-apis */
} from '@wordpress/components';
import {
	/* eslint-disable @wordpress/no-unsafe-wp-apis -- Matches Gutenberg editor settings link suggestion wiring. */
	__experimentalFetchLinkSuggestions as fetchLinkSuggestions,
	/* eslint-enable @wordpress/no-unsafe-wp-apis */
	store as coreDataStore,
	useEntityBlockEditor,
} from '@wordpress/core-data';
import {
	createReduxStore,
	dispatch,
	register,
	resolveSelect,
	select,
	useDispatch,
	useSelect,
} from '@wordpress/data';
import { DataViewsPicker, filterSortAndPaginate } from '@wordpress/dataviews';
import { DataViews } from '@wordpress/dataviews/wp';
import {
	createElement as el,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { escapeHTML } from '@wordpress/escape-html';
import { decodeEntities } from '@wordpress/html-entities';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	addSubmenu,
	archive,
	blockDefault,
	category,
	chevronLeft,
	chevronDown,
	chevronRight,
	chevronUp,
	customLink,
	file,
	image,
	layout,
	link,
	moreVertical,
	navigation,
	page,
	pencil,
	plus,
	postList,
	postCategories,
	trash,
	seen,
	update,
} from '@wordpress/icons';
import { useEditorAssets, useEditorSettings } from '@wordpress/lazy-editor';
import { MediaUpload } from '@wordpress/media-utils';
import { store as noticesStore } from '@wordpress/notices';
import { EmptyState, Tabs } from '@wordpress/ui';
import { addQueryArgs, getPath, safeDecodeURI } from '@wordpress/url';

export {
	addSubmenu as addSubmenuIcon,
	addQueryArgs,
	apiFetch,
	archive as archiveIcon,
	blockEditorStore,
	BlockEditorProvider,
	blockDefault as blockDefaultIcon,
	BlockList,
	blocksStore,
	BlockTitle,
	Breadcrumbs,
	Button,
	category as categoryIcon,
	chevronDown as chevronDownIcon,
	CheckboxControl,
	chevronLeft as chevronLeftIcon,
	chevronRight as chevronRightIcon,
	chevronUp as chevronUpIcon,
	coreDataStore,
	createBlock,
	createReduxStore,
	DataViews,
	DataViewsPicker,
	decodeEntities,
	dispatch,
	DropdownMenu,
	el,
	EmptyState,
	escapeHTML,
	file as fileIcon,
	filterSortAndPaginate,
	fetchLinkSuggestions,
	getPath,
	hasBlockSupport,
	Icon,
	image as imageIcon,
	layout as layoutIcon,
	LinkControl,
	link as linkIcon,
	customLink as customLinkIcon,
	HStack,
	MenuGroup,
	MenuItem,
	MediaUpload,
	moreVertical as moreVerticalIcon,
	Modal,
	navigation as compassIcon,
	noticesStore,
	Notice,
	page as pageIcon,
	parseBlocks,
	pencil as pencilIcon,
	plus as plusIcon,
	Popover,
	postCategories as postCategoriesIcon,
	Page,
	postList as postListIcon,
	register,
	registerCoreBlocks,
	resolveSelect,
	safeDecodeURI,
	SelectControl,
	seen as seenIcon,
	select,
	serialize,
	Spinner,
	sprintf,
	Tabs,
	TextControl,
	trash as trashIcon,
	update as updateIcon,
	useBlockBindingsUtils,
	useBlockEditingMode,
	useCallback,
	useDispatch,
	useEditorAssets,
	useEditorSettings,
	useEntityBlockEditor,
	useEffect,
	useMemo,
	useRef,
	useSelect,
	useState,
	VStack,
	__,
	_n,
};
