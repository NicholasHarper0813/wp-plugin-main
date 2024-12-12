<?php define( 'JWPLAYER_PLUGIN_DIR', dirname( __FILE__ ) );

require_once( JWPLAYER_PLUGIN_DIR . '/include/jwplayer-api.class.php' );
require_once( JWPLAYER_PLUGIN_DIR . '/include/admin.php' );
require_once( JWPLAYER_PLUGIN_DIR . '/include/ajax.php' );
require_once( JWPLAYER_PLUGIN_DIR . '/include/api.php' );
require_once( JWPLAYER_PLUGIN_DIR . '/include/login.php' );
require_once( JWPLAYER_PLUGIN_DIR . '/include/media.php' );
require_once( JWPLAYER_PLUGIN_DIR . '/include/proxy.php' );
require_once( JWPLAYER_PLUGIN_DIR . '/include/settings.php' );
require_once( JWPLAYER_PLUGIN_DIR . '/include/shortcode.php' );
require_once( JWPLAYER_PLUGIN_DIR . '/include/validation.php' );
require_once( JWPLAYER_PLUGIN_DIR . '/include/utils.php' );

define( 'JWPLAYER_PLUGIN_VERSION', '1.6.0' );
define( 'JWPLAYER_MINIMUM_PHP_VERSION', '5.4.0' );
define( 'JWPLAYER_PLAYER', 'ALJ3XQCI' );
define( 'JWPLAYER_DASHBOARD', 'https://dashboard.jwplayer.com/' );
define( 'JWPLAYER_TIMEOUT', '0' );
define( 'JWPLAYER_CONTENT_MASK', 'content.jwplatform.com' );
define( 'JWPLAYER_NR_VIDEOS', '5' );
define( 'JWPLAYER_CUSTOM_SHORTCODE_OPTIONS', wp_json_encode( array( 'content', 'excerpt', 'strip' ) ) );
define( 'JWPLAYER_SHOW_WIDGET', true );
define( 'JWPLAYER_ENABLE_SYNC', true );
define( 'JWPLAYER_CUSTOM_SHORTCODE_PARSER', false );
define( 'JWPLAYER_CUSTOM_SHORTCODE_FILTER', 'content' );

$jwplayer_media_mime_types = array(
	'video/mp4',
	'video/flv',
	'video/webm',
	'audio/acc',
	'audio/mpeg',
	'audio/ogg',
);

define( 'JWPLAYER_MEDIA_MIME_TYPES', wp_json_encode( $jwplayer_media_mime_types ) );

$jwplayer_source_format_extensions = array(
	'aac' => array( 'aac', 'm4a', 'f4a' ),
	'flv' => array( 'flv' ),
	'm3u8' => array( 'm3u', 'm3u8' ),
	'mp3' => array( 'mp3' ),
	'mp4' => array( 'mp4', 'm4v', 'f4v', 'mov' ),
	'rtmp' => array( 'rtmp', 'rtmpt', 'rtmpe', 'rtmpte' ),
	'smil' => array( 'smil' ),
	'vorbis' => array( 'ogg', 'oga' ),
	'webm' => array( 'webm' ),
);
define( 'JWPLAYER_SOURCE_FORMAT_EXTENSIONS', wp_json_encode( $jwplayer_source_format_extensions ) );
define( 'JWPLAYER_DISABLE_FITVIDS', true );

function jwplayer_add_options() 
{
	add_option( 'jwplayer_player', JWPLAYER_PLAYER );
	add_option( 'jwplayer_timeout', JWPLAYER_TIMEOUT );
	add_option( 'jwplayer_content_mask', JWPLAYER_CONTENT_MASK );
	add_option( 'jwplayer_nr_videos', JWPLAYER_NR_VIDEOS );
	add_option( 'jwplayer_show_widget', JWPLAYER_SHOW_WIDGET );
	add_option( 'jwplayer_enable_sync', JWPLAYER_ENABLE_SYNC );
	add_option( 'jwplayer_custom_shortcode_parser', JWPLAYER_CUSTOM_SHORTCODE_PARSER );
	add_option( 'jwplayer_shortcode_category_filter', JWPLAYER_CUSTOM_SHORTCODE_FILTER );
	add_option( 'jwplayer_shortcode_search_filter', JWPLAYER_CUSTOM_SHORTCODE_FILTER );
	add_option( 'jwplayer_shortcode_tag_filter', JWPLAYER_CUSTOM_SHORTCODE_FILTER );
	add_option( 'jwplayer_shortcode_home_filter', JWPLAYER_CUSTOM_SHORTCODE_FILTER );
}

if ( defined( 'WPCOM_IS_VIP_ENV' ) && true === WPCOM_IS_VIP_ENV ) 
{
	if ( ! get_option( 'jwplayer_player' ) ) {
		jwplayer_add_options();
	}
} 
else 
{
	register_activation_hook( __FILE__, 'jwplayer_add_options' );
}

add_action( 'admin_menu', 'jwplayer_settings_init' );
if ( get_option( 'jwplayer_api_key' ) ) {
	add_action( 'admin_head-post.php', 'jwplayer_admin_head' );
	add_action( 'admin_head-post-new.php', 'jwplayer_admin_head' );
	add_action( 'admin_head-media-upload-popup', 'jwplayer_admin_head' );
	add_action( 'admin_enqueue_scripts', 'jwplayer_admin_enqueue_scripts' );
} 
else if ( version_compare( PHP_VERSION, JWPLAYER_MINIMUM_PHP_VERSION, '<' ) ) 
{
	add_action( 'admin_notices', 'jwplayer_admin_show_version_notice' );
} 
else {
	add_action( 'admin_notices', 'jwplayer_admin_show_login_notice' );
}

// Initialize the login and logout pages:
add_action( 'admin_menu', 'jwplayer_login_create_pages' );

// Initialize the media pages:
if ( get_option( 'jwplayer_enable_sync', JWPLAYER_ENABLE_SYNC ) ) {
	add_filter( 'attachment_fields_to_edit', 'jwplayer_media_attachment_fields_to_edit', 99, 2 );
	add_filter( 'attachment_fields_to_save', 'jwplayer_media_attachment_fields_to_save', 99, 2 );
}
add_filter( 'media_upload_tabs', 'jwplayer_media_menu' );

add_action( 'delete_attachment', 'jwplayer_media_delete_attachment' );
add_action( 'edit_attachment', 'jwplayer_media_edit_attachment' );
add_action( 'media_upload_jwplayer', 'jwplayer_media_handle' );
add_action( 'admin_menu', 'jwplayer_media_add_video_box' );

if ( get_option( 'jwplayer_custom_shortcode_parser' ) ) {
	add_filter( 'the_content', 'jwplayer_shortcode_content_filter', 11 );
	add_filter( 'the_excerpt', 'jwplayer_shortcode_excerpt_filter', 11 );
	add_filter( 'widget_text', 'jwplayer_shortcode_widget_text_filter',  11 );
} 
else 
{
	add_shortcode( 'jwplayer', 'jwplayer_shortcode_handle' );
	add_shortcode( 'jwplatform', 'jwplayer_shortcode_handle' );
}

if  ( ! defined( 'WPCOM_IS_VIP_ENV' ) ) 
{
	require_once( JWPLAYER_PLUGIN_DIR . '/include/import.php' );
	add_action( 'admin_menu', 'jwplayer_import_check_and_init' );
}
