/**
 * Internal dependencies
 */
import {
	getNavigationRestBase,
	namespace as defaultNamespace,
	settings as appSettings,
} from './settings';
import {
	__,
	addQueryArgs,
	apiFetch,
	createReduxStore,
	register,
	select,
} from './wordpress-packages';

export const STORE_NAME = 'create-not-learn-editor/editor';

const DEFAULT_STATE = {
	navigationMenus: {
		error: null,
		isCreating: false,
		isLoading: false,
		records: [],
	},
	previewContexts: {},
	setupDefaults: {
		error: null,
		isRunning: false,
		result: null,
	},
	siteSettings: {
		error: null,
		isLoading: false,
		isSaving: false,
		record: null,
	},
};

let didConfigureApiFetch = false;

function configureApiFetch() {
	if ( didConfigureApiFetch || ! apiFetch ) {
		return;
	}

	if ( appSettings.nonce && apiFetch.createNonceMiddleware ) {
		apiFetch.use( apiFetch.createNonceMiddleware( appSettings.nonce ) );
	}

	didConfigureApiFetch = true;
}

function request( options ) {
	configureApiFetch();

	return apiFetch( options );
}

function requestKey( key ) {
	return String( key || '' );
}

const actions = {
	createDefaultNavigationMenu() {
		return async ( { dispatch } ) => {
			dispatch.startCreatingNavigationMenu();

			try {
				const menu = await request( {
					data: {
						content: '<!-- wp:page-list /-->',
						status: 'publish',
						title: __( 'Main menu' ),
					},
					method: 'POST',
					path: `/wp/v2/${ getNavigationRestBase() }`,
				} );

				dispatch.receiveCreatedNavigationMenu( menu );
				return menu;
			} catch ( error ) {
				dispatch.receiveNavigationMenusError( error );
				throw error;
			}
		};
	},

	createAutoDraft( typeName, restNamespace = defaultNamespace ) {
		return () =>
			request( {
				data: {
					type: typeName,
				},
				method: 'POST',
				path: `/${ restNamespace }/auto-drafts`,
			} );
	},

	invalidateNavigationMenus() {
		return ( { dispatch } ) =>
			dispatch.invalidateResolution( 'getNavigationMenus', [] );
	},

	invalidatePreviewContext( url, restNamespace = defaultNamespace ) {
		return ( { dispatch } ) =>
			dispatch.invalidateResolution( 'getPreviewContext', [
				url,
				restNamespace,
			] );
	},

	invalidateSiteSettings() {
		return ( { dispatch } ) =>
			dispatch.invalidateResolution( 'getSiteSettings', [] );
	},

	receiveCreatedNavigationMenu( menu ) {
		return {
			menu,
			type: 'RECEIVE_CREATED_NAVIGATION_MENU',
		};
	},

	receiveNavigationMenus( records ) {
		return {
			records,
			type: 'RECEIVE_NAVIGATION_MENUS',
		};
	},

	receiveNavigationMenusError( error ) {
		return {
			error,
			type: 'RECEIVE_NAVIGATION_MENUS_ERROR',
		};
	},

	receivePreviewContext( url, context ) {
		return {
			context,
			type: 'RECEIVE_PREVIEW_CONTEXT',
			url,
		};
	},

	receivePreviewContextError( url, error ) {
		return {
			error,
			type: 'RECEIVE_PREVIEW_CONTEXT_ERROR',
			url,
		};
	},

	receiveSetupDefaultsError( error ) {
		return {
			error,
			type: 'RECEIVE_SETUP_DEFAULTS_ERROR',
		};
	},

	receiveSetupDefaultsResult( result ) {
		return {
			result,
			type: 'RECEIVE_SETUP_DEFAULTS_RESULT',
		};
	},

	receiveSiteSettings( record ) {
		return {
			record,
			type: 'RECEIVE_SITE_SETTINGS',
		};
	},

	receiveSiteSettingsError( error ) {
		return {
			error,
			type: 'RECEIVE_SITE_SETTINGS_ERROR',
		};
	},

	saveSiteSettings( data ) {
		return async ( { dispatch } ) => {
			dispatch.startSavingSiteSettings();

			try {
				const settings = await request( {
					data,
					method: 'POST',
					path: '/wp/v2/settings',
				} );

				dispatch.receiveSiteSettings( settings );
				return settings;
			} catch ( error ) {
				dispatch.receiveSiteSettingsError( error );
				throw error;
			}
		};
	},

	setupDefaults( restNamespace = defaultNamespace ) {
		return async ( { dispatch } ) => {
			dispatch.startSetupDefaultsRequest();

			try {
				const result = await request( {
					method: 'POST',
					path: `/${ restNamespace }/setup-defaults`,
				} );

				dispatch.receiveSetupDefaultsResult( result );
				return result;
			} catch ( error ) {
				dispatch.receiveSetupDefaultsError( error );
				throw error;
			}
		};
	},

	startCreatingNavigationMenu() {
		return {
			type: 'START_CREATING_NAVIGATION_MENU',
		};
	},

	startNavigationMenusRequest() {
		return {
			type: 'START_NAVIGATION_MENUS_REQUEST',
		};
	},

	startPreviewContextRequest( url ) {
		return {
			type: 'START_PREVIEW_CONTEXT_REQUEST',
			url,
		};
	},

	startSetupDefaultsRequest() {
		return {
			type: 'START_SETUP_DEFAULTS_REQUEST',
		};
	},

	startSavingSiteSettings() {
		return {
			type: 'START_SAVING_SITE_SETTINGS',
		};
	},

	startSiteSettingsRequest() {
		return {
			type: 'START_SITE_SETTINGS_REQUEST',
		};
	},
};

const selectors = {
	getNavigationMenus( state ) {
		return state.navigationMenus.records;
	},

	getNavigationMenusError( state ) {
		return state.navigationMenus.error;
	},

	getPreviewContext( state, url ) {
		return state.previewContexts[ requestKey( url ) ]?.record || null;
	},

	getPreviewContextError( state, url ) {
		return state.previewContexts[ requestKey( url ) ]?.error || null;
	},

	getSetupDefaultsResult( state ) {
		return state.setupDefaults.result;
	},

	getSiteSettings( state ) {
		return state.siteSettings.record;
	},

	getSiteSettingsError( state ) {
		return state.siteSettings.error;
	},

	isCreatingNavigationMenu( state ) {
		return state.navigationMenus.isCreating;
	},

	isFetchingNavigationMenus( state ) {
		return state.navigationMenus.isLoading;
	},

	isFetchingPreviewContext( state, url ) {
		return Boolean( state.previewContexts[ requestKey( url ) ]?.isLoading );
	},

	isFetchingSiteSettings( state ) {
		return state.siteSettings.isLoading;
	},

	isRunningSetupDefaults( state ) {
		return state.setupDefaults.isRunning;
	},

	isSavingSiteSettings( state ) {
		return state.siteSettings.isSaving;
	},
};

const resolvers = {
	getNavigationMenus:
		() =>
		async ( { dispatch } ) => {
			dispatch.startNavigationMenusRequest();

			try {
				const records = await request( {
					path: addQueryArgs( `/wp/v2/${ getNavigationRestBase() }`, {
						context: 'edit',
						per_page: 20,
						status: 'publish,draft',
						_fields: 'id,slug,title,status,content,modified_gmt',
					} ),
				} );

				dispatch.receiveNavigationMenus( records );
			} catch ( error ) {
				dispatch.receiveNavigationMenusError( error );
				throw error;
			}
		},

	getPreviewContext:
		( url, restNamespace = defaultNamespace ) =>
		async ( { dispatch } ) => {
			dispatch.startPreviewContextRequest( url );

			try {
				const context = await request( {
					path: addQueryArgs( `/${ restNamespace }/preview-context`, {
						url,
					} ),
				} );

				dispatch.receivePreviewContext( url, context );
			} catch ( error ) {
				dispatch.receivePreviewContextError( url, error );
				throw error;
			}
		},

	getSiteSettings:
		() =>
		async ( { dispatch } ) => {
			dispatch.startSiteSettingsRequest();

			try {
				const settings = await request( {
					path: addQueryArgs( '/wp/v2/settings', {
						_fields: 'title,description,site_logo,site_icon',
					} ),
				} );

				dispatch.receiveSiteSettings( settings );
			} catch ( error ) {
				dispatch.receiveSiteSettingsError( error );
				throw error;
			}
		},
};

function reducer( state = DEFAULT_STATE, action ) {
	switch ( action.type ) {
		case 'RECEIVE_CREATED_NAVIGATION_MENU':
			return {
				...state,
				navigationMenus: {
					error: null,
					isCreating: false,
					isLoading: false,
					records: [
						action.menu,
						...state.navigationMenus.records.filter(
							( menu ) => menu.id !== action.menu?.id
						),
					],
				},
			};

		case 'RECEIVE_NAVIGATION_MENUS':
			return {
				...state,
				navigationMenus: {
					error: null,
					isCreating: false,
					isLoading: false,
					records: action.records || [],
				},
			};

		case 'RECEIVE_NAVIGATION_MENUS_ERROR':
			return {
				...state,
				navigationMenus: {
					...state.navigationMenus,
					error: action.error,
					isCreating: false,
					isLoading: false,
				},
			};

		case 'RECEIVE_PREVIEW_CONTEXT': {
			const key = requestKey( action.url );
			return {
				...state,
				previewContexts: {
					...state.previewContexts,
					[ key ]: {
						error: null,
						isLoading: false,
						record: action.context || {},
					},
				},
			};
		}

		case 'RECEIVE_PREVIEW_CONTEXT_ERROR': {
			const key = requestKey( action.url );
			return {
				...state,
				previewContexts: {
					...state.previewContexts,
					[ key ]: {
						...state.previewContexts[ key ],
						error: action.error,
						isLoading: false,
					},
				},
			};
		}

		case 'RECEIVE_SETUP_DEFAULTS_ERROR':
			return {
				...state,
				setupDefaults: {
					error: action.error,
					isRunning: false,
					result: null,
				},
			};

		case 'RECEIVE_SETUP_DEFAULTS_RESULT':
			return {
				...state,
				setupDefaults: {
					error: null,
					isRunning: false,
					result: action.result || null,
				},
			};

		case 'RECEIVE_SITE_SETTINGS':
			return {
				...state,
				siteSettings: {
					error: null,
					isLoading: false,
					isSaving: false,
					record: action.record || {},
				},
			};

		case 'RECEIVE_SITE_SETTINGS_ERROR':
			return {
				...state,
				siteSettings: {
					...state.siteSettings,
					error: action.error,
					isLoading: false,
					isSaving: false,
				},
			};

		case 'START_CREATING_NAVIGATION_MENU':
			return {
				...state,
				navigationMenus: {
					...state.navigationMenus,
					error: null,
					isCreating: true,
				},
			};

		case 'START_NAVIGATION_MENUS_REQUEST':
			return {
				...state,
				navigationMenus: {
					...state.navigationMenus,
					error: null,
					isLoading: true,
				},
			};

		case 'START_PREVIEW_CONTEXT_REQUEST': {
			const key = requestKey( action.url );
			return {
				...state,
				previewContexts: {
					...state.previewContexts,
					[ key ]: {
						...state.previewContexts[ key ],
						error: null,
						isLoading: true,
					},
				},
			};
		}

		case 'START_SETUP_DEFAULTS_REQUEST':
			return {
				...state,
				setupDefaults: {
					error: null,
					isRunning: true,
					result: null,
				},
			};

		case 'START_SAVING_SITE_SETTINGS':
			return {
				...state,
				siteSettings: {
					...state.siteSettings,
					error: null,
					isSaving: true,
				},
			};

		case 'START_SITE_SETTINGS_REQUEST':
			return {
				...state,
				siteSettings: {
					...state.siteSettings,
					error: null,
					isLoading: true,
				},
			};
	}

	return state;
}

export const cnlEditorStore = createReduxStore( STORE_NAME, {
	actions,
	reducer,
	resolvers,
	selectors,
} );

if ( ! select( STORE_NAME ) ) {
	register( cnlEditorStore );
}

export function getTitleText( title ) {
	const rendered =
		typeof title === 'string' ? title : title?.rendered || title?.raw || '';
	const element = document.createElement( 'textarea' );
	element.innerHTML = rendered.replace( /<[^>]+>/g, '' ).trim();
	return element.value || 'Untitled';
}

export function getTemplateAuthorText( template ) {
	if ( template?.source === 'theme' && appSettings.themeName ) {
		return appSettings.themeName;
	}

	if ( template?.theme ) {
		return template.theme
			.replace( /-/g, ' ' )
			.replace( /\b\w/g, ( letter ) => letter.toUpperCase() );
	}

	return __( 'Site editor' );
}

export function getNavigationMenuItemCount( menu ) {
	const content = menu?.content?.raw || menu?.content?.rendered || '';
	const blockMatches = content.match( /<!--\s+wp:/g );

	return blockMatches ? blockMatches.length : 0;
}

export function getErrorMessage( error ) {
	return error?.message || __( 'Request failed.' );
}
