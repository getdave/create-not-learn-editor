#!/usr/bin/env node
/* eslint no-console: [ 'error', { allow: [ 'error', 'warn', 'log' ] } ] */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const execFileAsync = promisify( execFile );

const repoRoot = path.resolve(
	fileURLToPath( new URL( '..', import.meta.url ) )
);
const vendorRelativeDir = path.join(
	'src',
	'vendor',
	'gutenberg',
	'list-view'
);
const vendorDir = path.join( repoRoot, vendorRelativeDir );
const patchRelativePath = path.join( 'patches', 'gutenberg-list-view.patch' );
const patchPath = path.join( repoRoot, patchRelativePath );
const sourcePackageDir = path.join(
	repoRoot,
	'node_modules',
	'@wordpress',
	'block-editor'
);
const sourceListViewDir = path.join(
	sourcePackageDir,
	'src',
	'components',
	'list-view'
);

const COPY_EXTENSIONS = new Set( [ '.js', '.jsx', '.scss', '.md' ] );
const JAVASCRIPT_EXTENSIONS = new Set( [ '.js', '.jsx' ] );

const importRewrites = [
	[ '../../store', './compat/block-editor-store' ],
	[ '../../lock-unlock', './compat/lock-unlock' ],
	[
		'../block-settings-menu/block-settings-dropdown',
		'./compat/block-settings-dropdown',
	],
	[ '../block-icon', './compat/block-icon' ],
	[
		'../use-block-display-information',
		'./compat/use-block-display-information',
	],
	[
		'../block-title/use-block-display-title',
		'./compat/use-block-display-title',
	],
	[ '../inserter', './compat/inserter' ],
	[ '../block-lock', './compat/block-lock' ],
	[ '../../utils/math', './compat/math' ],
	[ '../../utils/group-blocks', './compat/group-blocks' ],
	[ '../use-on-block-drop', './compat/use-on-block-drop' ],
	[ '../block-mover/button', './compat/block-mover-button' ],
	[ '../block-rename', './compat/block-rename' ],
	[ '../use-paste-styles', './compat/use-paste-styles' ],
	[ '../block-visibility', './compat/block-visibility' ],
	[ '../use-moving-animation', './compat/use-moving-animation' ],
	[ '../block-draggable', './compat/block-draggable' ],
	[ '../../utils/use-notify-copy', './compat/use-notify-copy' ],
	[ '../writing-flow/utils', './compat/writing-flow-utils' ],
];

const compatCopies = [
	{
		source: [ 'src', 'components', 'use-on-block-drop', 'index.js' ],
		target: [ 'compat', 'use-on-block-drop.js' ],
		rewrites: [ [ '../../store', './block-editor-store' ] ],
	},
	{
		source: [ 'src', 'components', 'use-moving-animation', 'index.js' ],
		target: [ 'compat', 'use-moving-animation.js' ],
		rewrites: [ [ '../../store', './block-editor-store' ] ],
	},
	{
		source: [ 'src', 'components', 'block-mover', 'button.jsx' ],
		target: [ 'compat', 'block-mover-button.js' ],
		rewrites: [
			[ './mover-description', './block-mover-description' ],
			[ '../../store', './block-editor-store' ],
		],
	},
	{
		source: [ 'src', 'components', 'block-mover', 'mover-description.js' ],
		target: [ 'compat', 'block-mover-description.js' ],
		rewrites: [],
	},
	{
		source: [ 'src', 'utils', 'use-notify-copy.js' ],
		target: [ 'compat', 'use-notify-copy.js' ],
		rewrites: [ [ '../store', './block-editor-store' ] ],
	},
	{
		source: [ 'src', 'components', 'writing-flow', 'utils.js' ],
		target: [ 'compat', 'writing-flow-utils.js' ],
		rewrites: [
			[ '../../utils/pasting', './pasting' ],
			[ '../../store', './block-editor-store' ],
		],
	},
	{
		source: [ 'build-module', 'utils', 'pasting.mjs' ],
		target: [ 'compat', 'pasting.js' ],
		rewrites: [],
	},
	{
		source: [ 'build-module', 'utils', 'math.mjs' ],
		target: [ 'compat', 'math.js' ],
		rewrites: [],
	},
	{
		source: [ 'src', 'utils', 'group-blocks.js' ],
		target: [ 'compat', 'group-blocks.js' ],
		rewrites: [],
	},
	{
		source: [ 'src', 'hooks', 'supports.js' ],
		target: [ 'compat', 'block-supports.js' ],
		rewrites: [],
	},
	{
		source: [ 'src', 'components', 'use-paste-styles', 'index.js' ],
		target: [ 'compat', 'use-paste-styles.js' ],
		rewrites: [
			[ '../../store', './block-editor-store' ],
			[ '../../hooks/supports', './block-supports' ],
		],
	},
	{
		source: [ 'src', 'components', 'block-visibility', 'utils.js' ],
		target: [ 'compat', 'block-visibility.js' ],
		rewrites: [
			[ './constants', './block-visibility-constants' ],
			[ '../../lock-unlock', './lock-unlock' ],
		],
	},
	{
		source: [ 'src', 'components', 'block-rename', 'modal.jsx' ],
		target: [ 'compat', 'block-rename-modal.js' ],
		rewrites: [
			[ '../../store', './block-editor-store' ],
			[ '..', './use-block-display-information' ],
			[ './is-empty-string', './is-empty-string' ],
			[ '../../hooks/utils', './object-utils' ],
		],
	},
	{
		source: [ 'src', 'components', 'block-rename', 'use-block-rename.js' ],
		target: [ 'compat', 'use-block-rename.js' ],
		rewrites: [],
	},
	{
		source: [ 'src', 'components', 'block-rename', 'is-empty-string.js' ],
		target: [ 'compat', 'is-empty-string.js' ],
		rewrites: [],
	},
];

const manualCompatFiles = {
	// Upstream source is now block-visibility/constants.ts. Reproduced without
	// the TypeScript-only syntax (type alias, `satisfies`) since this bridge
	// is plain JS; the runtime values must stay in sync with that file by hand.
	'compat/block-visibility-constants.js': `import { __ } from '@wordpress/i18n';\nimport { desktop, tablet, mobile } from '@wordpress/icons';\n\nexport const BLOCK_VISIBILITY_VIEWPORTS = {\n\tdesktop: {\n\t\tlabel: __( 'Desktop' ),\n\t\ticon: desktop,\n\t\tkey: 'desktop',\n\t},\n\ttablet: {\n\t\tlabel: __( 'Tablet' ),\n\t\ticon: tablet,\n\t\tkey: 'tablet',\n\t},\n\tmobile: {\n\t\tlabel: __( 'Mobile' ),\n\t\ticon: mobile,\n\t\tkey: 'mobile',\n\t},\n};\n\nexport const BLOCK_VISIBILITY_VIEWPORT_ENTRIES = Object.entries(\n\tBLOCK_VISIBILITY_VIEWPORTS\n);\n`,
	'compat/block-editor-store.js': `export { store } from '@wordpress/block-editor';\n`,
	'compat/block-settings-dropdown.js': `export { BlockSettingsMenu as BlockSettingsDropdown } from '@wordpress/block-editor';\n`,
	'compat/block-icon.js': `export { BlockIcon as default } from '@wordpress/block-editor';\n`,
	// getPositionTypeLabel is not part of block-editor's public API; it is a
	// standalone helper alongside the useBlockDisplayInformation hook, which
	// the public package does export, so only the helper needs reproducing.
	'compat/use-block-display-information.js': `import { __ } from '@wordpress/i18n';\n\nexport { useBlockDisplayInformation as default } from '@wordpress/block-editor';\nexport { useBlockDisplayInformation } from '@wordpress/block-editor';\n\nexport function getPositionTypeLabel( attributes ) {\n\tconst positionType = attributes?.style?.position?.type;\n\n\tif ( positionType === 'sticky' ) {\n\t\treturn __( 'Sticky' );\n\t}\n\n\tif ( positionType === 'fixed' ) {\n\t\treturn __( 'Fixed' );\n\t}\n\n\treturn null;\n}\n`,
	'compat/inserter.js': `export { Inserter as default } from '@wordpress/block-editor';\n`,
	'compat/lock-unlock.js': `import { __dangerousOptInToUnstableAPIsOnlyForCoreModules } from '@wordpress/private-apis';\n\nexport const { lock, unlock } =\n\t__dangerousOptInToUnstableAPIsOnlyForCoreModules(\n\t\t'I acknowledge private features are not for use in themes or plugins and doing so will break in the next version of WordPress.',\n\t\t'@wordpress/block-editor'\n\t);\n`,
	'compat/block-lock.js': `import { useSelect } from '@wordpress/data';\n\nimport { store as blockEditorStore } from './block-editor-store';\nimport { unlock } from './lock-unlock';\n\nexport function useBlockLock( clientId ) {\n\treturn useSelect(\n\t\t( select ) => {\n\t\t\tconst {\n\t\t\t\tcanLockBlockType,\n\t\t\t\tgetBlockName,\n\t\t\t\tisEditLockedBlock,\n\t\t\t\tisMoveLockedBlock,\n\t\t\t\tisRemoveLockedBlock,\n\t\t\t\tisLockedBlock,\n\t\t\t} = unlock( select( blockEditorStore ) );\n\n\t\t\treturn {\n\t\t\t\tisEditLocked: isEditLockedBlock( clientId ),\n\t\t\t\tisMoveLocked: isMoveLockedBlock( clientId ),\n\t\t\t\tisRemoveLocked: isRemoveLockedBlock( clientId ),\n\t\t\t\tcanLock: canLockBlockType( getBlockName( clientId ) ),\n\t\t\t\tisLocked: isLockedBlock( clientId ),\n\t\t\t};\n\t\t},\n\t\t[ clientId ]\n\t);\n}\n`,
	'compat/use-block-display-title.js': `import { useSelect } from '@wordpress/data';\nimport {\n\t__experimentalGetBlockLabel as getBlockLabel,\n\tstore as blocksStore,\n} from '@wordpress/blocks';\n\nimport { store as blockEditorStore } from './block-editor-store';\n\nexport default function useBlockDisplayTitle( {\n\tclientId,\n\tmaximumLength,\n\tcontext,\n} ) {\n\tconst blockTitle = useSelect(\n\t\t( select ) => {\n\t\t\tif ( ! clientId ) {\n\t\t\t\treturn null;\n\t\t\t}\n\n\t\t\tconst { getBlockName, getBlockAttributes } =\n\t\t\t\tselect( blockEditorStore );\n\t\t\tconst { getBlockType, getActiveBlockVariation } =\n\t\t\t\tselect( blocksStore );\n\n\t\t\tconst blockName = getBlockName( clientId );\n\t\t\tconst blockType = getBlockType( blockName );\n\t\t\tif ( ! blockType ) {\n\t\t\t\treturn null;\n\t\t\t}\n\n\t\t\tconst attributes = getBlockAttributes( clientId );\n\t\t\tconst label = getBlockLabel( blockType, attributes, context );\n\t\t\tif ( label !== blockType.title ) {\n\t\t\t\treturn label;\n\t\t\t}\n\n\t\t\tconst match = getActiveBlockVariation( blockName, attributes );\n\t\t\treturn match?.title || blockType.title;\n\t\t},\n\t\t[ clientId, context ]\n\t);\n\n\tif ( ! blockTitle ) {\n\t\treturn null;\n\t}\n\n\tif (\n\t\tmaximumLength &&\n\t\tmaximumLength > 0 &&\n\t\tblockTitle.length > maximumLength\n\t) {\n\t\tconst omission = '...';\n\t\treturn (\n\t\t\tblockTitle.slice( 0, maximumLength - omission.length ) + omission\n\t\t);\n\t}\n\n\treturn blockTitle;\n}\n`,
	'compat/object-utils.js': `export const cleanEmptyObject = ( object ) => {\n\tif (\n\t\tobject === null ||\n\t\ttypeof object !== 'object' ||\n\t\tArray.isArray( object )\n\t) {\n\t\treturn object;\n\t}\n\n\tconst cleanedNestedObjects = Object.entries( object )\n\t\t.map( ( [ key, value ] ) => [ key, cleanEmptyObject( value ) ] )\n\t\t.filter( ( [ , value ] ) => value !== undefined );\n\n\treturn cleanedNestedObjects.length\n\t\t? Object.fromEntries( cleanedNestedObjects )\n\t\t: undefined;\n};\n`,
	'compat/block-rename.js': `export { default as BlockRenameModal } from './block-rename-modal';\nexport { default as useBlockRename } from './use-block-rename';\n`,
	'compat/block-draggable.js': `import { store as blocksStore } from '@wordpress/blocks';\nimport { Draggable } from '@wordpress/components';\nimport { useDispatch, useSelect } from '@wordpress/data';\n\nimport { store as blockEditorStore } from './block-editor-store';\nimport BlockIcon from './block-icon';\n\nfunction BlockDraggableChip( { count, icon } ) {\n\treturn (\n\t\t<div className=\"block-editor-list-view-draggable-chip\">\n\t\t\t<BlockIcon icon={ icon } showColors context=\"list-view\" />\n\t\t\t{ count > 1 && (\n\t\t\t\t<span className=\"block-editor-list-view-draggable-chip__count\">\n\t\t\t\t\t{ count }\n\t\t\t\t</span>\n\t\t\t) }\n\t\t</div>\n\t);\n}\n\nexport default function BlockDraggable( {\n\tappendToOwnerDocument,\n\tchildren,\n\tclientIds,\n\tcloneClassname,\n\telementId,\n\tonDragStart,\n\tonDragEnd,\n\tdragComponent,\n} ) {\n\tconst { srcRootClientId, isDraggable, icon } = useSelect(\n\t\t( select ) => {\n\t\t\tconst {\n\t\t\t\tcanMoveBlocks,\n\t\t\t\tgetBlockRootClientId,\n\t\t\t\tgetBlockName,\n\t\t\t\tgetBlockAttributes,\n\t\t\t} = select( blockEditorStore );\n\t\t\tconst { getBlockType, getActiveBlockVariation } = select( blocksStore );\n\t\t\tconst firstClientId = clientIds[ 0 ];\n\t\t\tconst blockName = getBlockName( firstClientId );\n\t\t\tconst variation = getActiveBlockVariation(\n\t\t\t\tblockName,\n\t\t\t\tgetBlockAttributes( firstClientId )\n\t\t\t);\n\n\t\t\treturn {\n\t\t\t\tsrcRootClientId: getBlockRootClientId( firstClientId ),\n\t\t\t\tisDraggable: canMoveBlocks( clientIds ),\n\t\t\t\ticon: variation?.icon || getBlockType( blockName )?.icon,\n\t\t\t};\n\t\t},\n\t\t[ clientIds ]\n\t);\n\tconst { startDraggingBlocks, stopDraggingBlocks } =\n\t\tuseDispatch( blockEditorStore );\n\n\tif ( ! isDraggable ) {\n\t\treturn children( { draggable: false } );\n\t}\n\n\treturn (\n\t\t<Draggable\n\t\t\tappendToOwnerDocument={ appendToOwnerDocument }\n\t\t\tcloneClassname={ cloneClassname }\n\t\t\t__experimentalTransferDataType=\"wp-blocks\"\n\t\t\ttransferData={ {\n\t\t\t\ttype: 'block',\n\t\t\t\tsrcClientIds: clientIds,\n\t\t\t\tsrcRootClientId,\n\t\t\t} }\n\t\t\tonDragStart={ () => {\n\t\t\t\twindow.requestAnimationFrame( () => {\n\t\t\t\t\tstartDraggingBlocks( clientIds );\n\t\t\t\t\tonDragStart?.();\n\t\t\t\t} );\n\t\t\t} }\n\t\t\tonDragEnd={ () => {\n\t\t\t\tstopDraggingBlocks();\n\t\t\t\tonDragEnd?.();\n\t\t\t} }\n\t\t\t__experimentalDragComponent={\n\t\t\t\tdragComponent !== undefined ? (\n\t\t\t\t\tdragComponent\n\t\t\t\t) : (\n\t\t\t\t\t<BlockDraggableChip count={ clientIds.length } icon={ icon } />\n\t\t\t\t)\n\t\t\t}\n\t\t\telementId={ elementId }\n\t\t>\n\t\t\t{ ( { onDraggableStart, onDraggableEnd } ) =>\n\t\t\t\tchildren( {\n\t\t\t\t\tdraggable: true,\n\t\t\t\t\tonDragStart: onDraggableStart,\n\t\t\t\t\tonDragEnd: onDraggableEnd,\n\t\t\t\t} ) }\n\t\t</Draggable>\n\t);\n}\n`,
};

export function rewriteImports( source, rewrites ) {
	return rewrites.reduce(
		( content, [ before, after ] ) =>
			content
				.replaceAll( `from '${ before }'`, `from '${ after }'` )
				.replaceAll( `from "${ before }"`, `from "${ after }"` ),
		source
	);
}

export function findUnknownInternalImports( relativeFile, source ) {
	const violations = [];
	const importPattern =
		/(?:import|export)\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
	let match;

	while ( ( match = importPattern.exec( source ) ) ) {
		const specifier = match[ 1 ];
		if ( specifier.startsWith( '../' ) ) {
			violations.push( `${ relativeFile }: ${ specifier }` );
		}
	}

	return violations;
}

export async function hashFile( file ) {
	const content = await fs.readFile( file );
	return crypto.createHash( 'sha256' ).update( content ).digest( 'hex' );
}

async function exists( file ) {
	try {
		await fs.access( file );
		return true;
	} catch {
		return false;
	}
}

async function readJson( file ) {
	return JSON.parse( await fs.readFile( file, 'utf8' ) );
}

async function listFilesRecursive( dir, base = dir ) {
	const entries = await fs.readdir( dir, { withFileTypes: true } );
	const files = [];

	for ( const entry of entries ) {
		const absolute = path.join( dir, entry.name );
		if ( entry.isDirectory() ) {
			files.push( ...( await listFilesRecursive( absolute, base ) ) );
		} else if ( entry.isFile() ) {
			files.push( path.relative( base, absolute ) );
		}
	}

	return files.sort();
}

function isJavaScriptFile( file ) {
	return JAVASCRIPT_EXTENSIONS.has( path.extname( file ) );
}

function toGeneratedJavaScriptFilename( file ) {
	return file.endsWith( '.js' )
		? `${ file.slice( 0, -'.js'.length ) }.jsx`
		: file;
}

function toGeneratedJavaScriptFilenames( files ) {
	return files.map( toGeneratedJavaScriptFilename ).sort();
}

async function writeFileEnsuringDir( file, content ) {
	await fs.mkdir( path.dirname( file ), { recursive: true } );
	await fs.writeFile( file, content );
}

async function copyListViewSources( targetVendorDir ) {
	const entries = await fs.readdir( sourceListViewDir, {
		withFileTypes: true,
	} );
	const copiedFiles = [];

	for ( const entry of entries ) {
		if (
			! entry.isFile() ||
			! COPY_EXTENSIONS.has( path.extname( entry.name ) )
		) {
			continue;
		}

		const sourceFile = path.join( sourceListViewDir, entry.name );
		const targetFile = path.join( targetVendorDir, entry.name );
		let content = await fs.readFile( sourceFile, 'utf8' );

		if ( isJavaScriptFile( entry.name ) ) {
			content = rewriteImports( content, importRewrites );
		}

		await writeFileEnsuringDir( targetFile, content );
		copiedFiles.push( entry.name );
	}

	return copiedFiles.sort();
}

async function copyCompatSources( targetVendorDir ) {
	const copiedFiles = [];

	for ( const copy of compatCopies ) {
		const sourceFile = path.join( sourcePackageDir, ...copy.source );
		const targetRelative = path.join( ...copy.target );
		const targetFile = path.join( targetVendorDir, targetRelative );
		let content = await fs.readFile( sourceFile, 'utf8' );
		content = rewriteImports( content, copy.rewrites );
		content = content.replace( /\/\/# sourceMappingURL=.*\n?$/u, '' );
		await writeFileEnsuringDir( targetFile, content );
		copiedFiles.push( targetRelative );
	}

	for ( const [ targetRelative, content ] of Object.entries(
		manualCompatFiles
	) ) {
		await writeFileEnsuringDir(
			path.join( targetVendorDir, targetRelative ),
			content
		);
		copiedFiles.push( targetRelative );
	}

	return copiedFiles.sort();
}

async function renameJavaScriptFilesToJsx( targetVendorDir ) {
	const files = ( await listFilesRecursive( targetVendorDir ) ).filter(
		( file ) => file.endsWith( '.js' )
	);

	await Promise.all(
		files.map( async ( file ) => {
			await fs.rename(
				path.join( targetVendorDir, file ),
				path.join(
					targetVendorDir,
					toGeneratedJavaScriptFilename( file )
				)
			);
		} )
	);
}

async function assertNoUnknownImports( targetVendorDir ) {
	const files = ( await listFilesRecursive( targetVendorDir ) ).filter(
		isJavaScriptFile
	);
	const violations = [];

	for ( const file of files ) {
		const content = await fs.readFile(
			path.join( targetVendorDir, file ),
			'utf8'
		);
		violations.push( ...findUnknownInternalImports( file, content ) );
	}

	if ( violations.length ) {
		throw new Error(
			`Unknown Gutenberg-internal imports remain:\n${ violations.join(
				'\n'
			) }`
		);
	}
}

async function assertRelativeImportsExist( targetVendorDir ) {
	const files = ( await listFilesRecursive( targetVendorDir ) ).filter(
		isJavaScriptFile
	);
	const missing = [];
	const importPattern =
		/(?:import|export)\s+(?:[^'"]+\s+from\s+)?['"](\.[^'"]+)['"]/g;

	for ( const file of files ) {
		const content = await fs.readFile(
			path.join( targetVendorDir, file ),
			'utf8'
		);
		const fileDir = path.dirname( path.join( targetVendorDir, file ) );
		let match;
		while ( ( match = importPattern.exec( content ) ) ) {
			const specifier = match[ 1 ];
			const resolved = path.resolve( fileDir, specifier );
			const candidates = [
				resolved,
				`${ resolved }.js`,
				`${ resolved }.jsx`,
				path.join( resolved, 'index.js' ),
				path.join( resolved, 'index.jsx' ),
			];
			const found = await Promise.any(
				candidates.map( async ( candidate ) => {
					if ( await exists( candidate ) ) {
						return candidate;
					}
					throw new Error( 'missing' );
				} )
			).catch( () => null );

			if ( ! found ) {
				missing.push( `${ file }: ${ specifier }` );
			}
		}
	}

	if ( missing.length ) {
		throw new Error(
			`Missing relative imports:\n${ missing.join( '\n' ) }`
		);
	}
}

async function applyPatch( targetRoot ) {
	if ( ! ( await exists( patchPath ) ) ) {
		throw new Error( `Missing patch file: ${ patchRelativePath }` );
	}

	const args = [ 'apply', '--whitespace=nowarn' ];
	const relativeTargetRoot = path.relative( repoRoot, targetRoot );
	if ( relativeTargetRoot ) {
		args.push( '--directory', relativeTargetRoot );
	}
	args.push( patchPath );

	await execFileAsync( 'git', args, { cwd: repoRoot } );
}

async function writeProvenance( targetVendorDir, copiedFiles, compatFiles ) {
	const packageJson = await readJson(
		path.join( sourcePackageDir, 'package.json' )
	);
	const patchChecksum = await hashFile( patchPath );
	const files = await listFilesRecursive( targetVendorDir );
	const provenance = {
		source: '@wordpress/block-editor',
		sourceVersion: packageJson.version,
		sourceGitHead: packageJson.gitHead || null,
		sourceDirectory: 'src/components/list-view',
		patch: patchRelativePath,
		patchChecksum,
		copiedFiles,
		compatFiles,
		generatedFiles: files.filter( ( file ) => file !== 'provenance.json' ),
	};

	await writeFileEnsuringDir(
		path.join( targetVendorDir, 'provenance.json' ),
		`${ JSON.stringify( provenance, null, '\t' ) }\n`
	);
}

export async function syncListView( { targetRoot = repoRoot } = {} ) {
	const targetVendorDir = path.join( targetRoot, vendorRelativeDir );
	await fs.rm( targetVendorDir, { recursive: true, force: true } );
	await fs.mkdir( targetVendorDir, { recursive: true } );

	let copiedFiles = await copyListViewSources( targetVendorDir );
	let compatFiles = await copyCompatSources( targetVendorDir );

	await assertNoUnknownImports( targetVendorDir );
	await assertRelativeImportsExist( targetVendorDir );
	await applyPatch( targetRoot );
	await renameJavaScriptFilesToJsx( targetVendorDir );
	copiedFiles = toGeneratedJavaScriptFilenames( copiedFiles );
	compatFiles = toGeneratedJavaScriptFilenames( compatFiles );
	await assertNoUnknownImports( targetVendorDir );
	await assertRelativeImportsExist( targetVendorDir );
	await writeProvenance( targetVendorDir, copiedFiles, compatFiles );

	return targetVendorDir;
}

export async function compareDirectories( expectedDir, actualDir ) {
	const expectedFiles = await listFilesRecursive( expectedDir );
	const actualFiles = await listFilesRecursive( actualDir );
	const allFiles = [
		...new Set( [ ...expectedFiles, ...actualFiles ] ),
	].sort();
	const differences = [];

	for ( const file of allFiles ) {
		const expectedFile = path.join( expectedDir, file );
		const actualFile = path.join( actualDir, file );
		if ( ! expectedFiles.includes( file ) ) {
			differences.push( `unexpected committed file: ${ file }` );
			continue;
		}
		if ( ! actualFiles.includes( file ) ) {
			differences.push( `missing committed file: ${ file }` );
			continue;
		}
		const [ expectedHash, actualHash ] = await Promise.all( [
			hashFile( expectedFile ),
			hashFile( actualFile ),
		] );
		if ( expectedHash !== actualHash ) {
			differences.push( `changed file: ${ file }` );
		}
	}

	return differences;
}

export async function checkListView() {
	const tempRoot = await fs.mkdtemp(
		path.join( repoRoot, '.tmp-list-view-check-' )
	);

	try {
		await syncListView( { targetRoot: tempRoot } );
		const expectedDir = path.join( tempRoot, vendorRelativeDir );
		const differences = await compareDirectories( expectedDir, vendorDir );

		if ( differences.length ) {
			throw new Error(
				`Vendored ListView is stale. Run npm run sync:list-view.\n${ differences.join(
					'\n'
				) }`
			);
		}
	} finally {
		await fs.rm( tempRoot, { recursive: true, force: true } );
	}
}

async function main() {
	const mode = process.argv.includes( '--check' ) ? 'check' : 'sync';

	if ( mode === 'check' ) {
		await checkListView();
		console.log( 'Vendored ListView is current.' );
		return;
	}

	await syncListView();
	console.log( `Synced Gutenberg ListView into ${ vendorRelativeDir }.` );
}

const entryPointUrl = process.argv[ 1 ]
	? pathToFileURL( process.argv[ 1 ] ).href
	: null;

if ( import.meta.url === entryPointUrl ) {
	main().catch( ( error ) => {
		console.error( error.message );
		process.exitCode = 1;
	} );
}
