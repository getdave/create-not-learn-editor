/**
 * The site's social links, edited as a list: the Header and Footer screens'
 * Social links view, and the chat's picker for them.
 */

/**
 * Internal dependencies
 */
import {
	getAddableServices,
	getService,
	isPlaceholderUrl,
	useSocialLinks,
} from './social-links';
import {
	BlockIcon,
	Button,
	Dropdown,
	DropdownMenu,
	InputControl,
	InputLayout,
	MenuGroup,
	MenuItem,
	Text,
	__,
	chevronDownIcon,
	chevronUpIcon,
	moreVerticalIcon,
	plusIcon,
	sprintf,
	trashIcon,
	useCallback,
	useState,
} from '../../wordpress-packages';

function Note( { children } ) {
	return (
		<Text className="routes-styles__muted" variant="body-md">
			{ children }
		</Text>
	);
}

function SocialLinkOptions( { index, isLast, onMove, onRemove, title } ) {
	return (
		<DropdownMenu
			icon={ moreVerticalIcon }
			label={ sprintf(
				/* translators: %s: Social service, like Instagram. */
				__( '%s options' ),
				title
			) }
			popoverProps={ { placement: 'bottom-end' } }
		>
			{ ( { onClose } ) => (
				<MenuGroup>
					<MenuItem
						accessibleWhenDisabled
						disabled={ index === 0 }
						icon={ chevronUpIcon }
						onClick={ () => {
							onMove( index, index - 1 );
							onClose();
						} }
					>
						{ __( 'Move up' ) }
					</MenuItem>
					<MenuItem
						accessibleWhenDisabled
						disabled={ isLast }
						icon={ chevronDownIcon }
						onClick={ () => {
							onMove( index, index + 1 );
							onClose();
						} }
					>
						{ __( 'Move down' ) }
					</MenuItem>
					<MenuItem
						icon={ trashIcon }
						onClick={ () => {
							onRemove( index );
							onClose();
						} }
					>
						{ __( 'Remove' ) }
					</MenuItem>
				</MenuGroup>
			) }
		</DropdownMenu>
	);
}

/**
 * Core's services not in the list yet, to search and pick one from.
 *
 * @param {Object}   props
 * @param {Object[]} props.services Core's Social Icon variations not used.
 * @param {Function} props.onAdd    Called with the picked service's name.
 * @return {Element} The button and its list.
 */
function AddSocialLink( { onAdd, services } ) {
	const [ search, setSearch ] = useState( '' );
	const term = search.trim().toLowerCase();
	const matches = term
		? services.filter( ( service ) =>
				service.title.toLowerCase().includes( term )
			)
		: services;

	if ( ! services.length ) {
		return null;
	}

	return (
		<Dropdown
			contentClassName="cnl-site-part__add-social"
			onClose={ () => setSearch( '' ) }
			popoverProps={ { placement: 'bottom-start' } }
			renderContent={ ( { onClose } ) => (
				<div className="cnl-site-part__add-social-content">
					<InputControl
						hideLabelFromVision
						label={ __( 'Search services' ) }
						onValueChange={ setSearch }
						placeholder={ __( 'Search' ) }
						value={ search }
					/>
					<MenuGroup className="cnl-site-part__add-social-list">
						{ matches.map( ( service ) => (
							<MenuItem
								icon={ <BlockIcon icon={ service.icon } /> }
								iconPosition="left"
								key={ service.name }
								onClick={ () => {
									onAdd( service.name );
									onClose();
								} }
							>
								{ service.title }
							</MenuItem>
						) ) }
					</MenuGroup>
					{ ! matches.length && (
						<Note>{ __( 'No services match.' ) }</Note>
					) }
				</div>
			) }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					__next40pxDefaultSize
					aria-expanded={ isOpen }
					icon={ plusIcon }
					onClick={ onToggle }
					variant="secondary"
				>
					{ __( 'Add social link' ) }
				</Button>
			) }
		/>
	);
}

// Keyed by service, so a row keeps its field as links move around it. A
// service listed twice is told apart by which time it is.
function getLinkKey( links, index ) {
	const { service } = links[ index ];
	const seen = links
		.slice( 0, index )
		.filter( ( link ) => link.service === service ).length;

	return `${ service }-${ seen }`;
}

/**
 * The site's social links, a row for each, with its address to fill in.
 * Changes show on the canvas as they are made and wait for the save.
 *
 * @param {Object} props
 * @param {string} props.area `header` or `footer`.
 * @return {Element} The links.
 */
export function SocialLinks( { area } ) {
	const { links, services, setLinks, setUrl } = useSocialLinks( area );
	// The service just added, whose address is focused once it shows.
	const [ added, setAdded ] = useState( null );
	const focusAdded = useCallback( ( node ) => {
		if ( node ) {
			node.focus();
			setAdded( null );
		}
	}, [] );

	if ( ! links ) {
		return (
			<Note>{ __( 'Your site doesn’t show social links here.' ) }</Note>
		);
	}

	const move = ( from, to ) => {
		const next = [ ...links ];
		next.splice( to, 0, ...next.splice( from, 1 ) );
		setLinks( next );
	};
	const remove = ( index ) =>
		setLinks( links.filter( ( link, i ) => i !== index ) );
	const add = ( name ) => {
		setLinks( [ ...links, { service: name, url: '' } ] );
		setAdded( name );
	};

	return (
		<div className="routes-styles__section cnl-site-part__social">
			{ ! links.length && <Note>{ __( 'No social links yet.' ) }</Note> }
			{ links.length > 0 && (
				<ul
					aria-label={ __( 'Social links' ) }
					className="cnl-site-part__social-links"
				>
					{ links.map( ( link, index ) => {
						const service = getService( services, link.service );

						return (
							<li
								className="cnl-site-part__social-link"
								key={ getLinkKey( links, index ) }
							>
								<InputControl
									label={ service.title }
									onValueChange={ ( url ) =>
										setUrl( index, url )
									}
									placeholder={ __( 'Add your address' ) }
									prefix={
										service.icon && (
											<InputLayout.Slot padding="minimal">
												<BlockIcon
													icon={ service.icon }
												/>
											</InputLayout.Slot>
										)
									}
									ref={
										link.service === added
											? focusAdded
											: undefined
									}
									type="url"
									value={
										isPlaceholderUrl( link.url )
											? ''
											: link.url
									}
								/>
								<SocialLinkOptions
									index={ index }
									isLast={ index === links.length - 1 }
									onMove={ move }
									onRemove={ remove }
									title={ service.title }
								/>
							</li>
						);
					} ) }
				</ul>
			) }
			<AddSocialLink
				onAdd={ add }
				services={ getAddableServices( services, links ) }
			/>
		</div>
	);
}
