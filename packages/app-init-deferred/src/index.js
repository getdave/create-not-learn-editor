/**
 * The parts of app init that nothing needs until someone opens them, too big
 * to hold up page boot: the chat panel's body, with the skills and pickers
 * behind it, and the editor's section picker. App init fetches this module
 * once the page has settled. See `src/app-init-deferred.js`.
 *
 * Unlike chat-extras, nothing here reaches the editor, so fetching it early
 * doesn't load the editor with it.
 */
export { startNewChat } from '../../../src/chat/conversation';
export { ChatBody } from '../../../src/chat/panel';
export { EditorSectionPicker } from '../../../src/editor-layer/section-picker';
