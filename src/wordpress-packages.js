/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { Breadcrumbs, Page } from '@wordpress/admin-ui';
import { registerCoreBlocks } from '@wordpress/block-library';
import { store as blocksStore } from '@wordpress/blocks';
import {
	Button,
	CheckboxControl,
	DropdownMenu,
	Icon,
	MenuGroup,
	MenuItem,
	Modal,
	Notice,
	SelectControl,
	Spinner,
	TextControl,
	/* eslint-disable @wordpress/no-unsafe-wp-apis -- Matches the prototype's modal layout components. */
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
	/* eslint-enable @wordpress/no-unsafe-wp-apis */
} from '@wordpress/components';
import { store as coreDataStore } from '@wordpress/core-data';
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
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
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
import { MediaUpload } from '@wordpress/media-utils';
import { store as noticesStore } from '@wordpress/notices';
import { EmptyState, Tabs } from '@wordpress/ui';
import { addQueryArgs } from '@wordpress/url';

export {
	addSubmenu as addSubmenuIcon,
	addQueryArgs,
	apiFetch,
	archive as archiveIcon,
	blockDefault as blockDefaultIcon,
	blocksStore,
	Breadcrumbs,
	Button,
	category as categoryIcon,
	chevronDown as chevronDownIcon,
	CheckboxControl,
	chevronLeft as chevronLeftIcon,
	chevronRight as chevronRightIcon,
	coreDataStore,
	createReduxStore,
	DataViews,
	DataViewsPicker,
	decodeEntities,
	dispatch,
	DropdownMenu,
	el,
	EmptyState,
	file as fileIcon,
	filterSortAndPaginate,
	Icon,
	image as imageIcon,
	layout as layoutIcon,
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
	pencil as pencilIcon,
	plus as plusIcon,
	postCategories as postCategoriesIcon,
	Page,
	postList as postListIcon,
	register,
	registerCoreBlocks,
	resolveSelect,
	SelectControl,
	seen as seenIcon,
	select,
	Spinner,
	sprintf,
	Tabs,
	TextControl,
	trash as trashIcon,
	update as updateIcon,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useSelect,
	useState,
	VStack,
	__,
	_n,
};
