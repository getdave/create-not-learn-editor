/**
 * Internal dependencies
 */
import { withUiTheme } from '../../theme';
import Canvas from './canvas';

// The canvas fills the whole stage. With no route canvas beside it, the stage
// takes all the room the sidebar leaves.
export const stage = withUiTheme( Canvas );
