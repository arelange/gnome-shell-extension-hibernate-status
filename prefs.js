const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Me = imports.misc.extensionUtils.getCurrentExtension();

const Prefs = new Lang.Class({
	KEY_HIBERNATE_WORKS_CHECK: "hibernate-works-check",
	Name: 'Prefs',
	_schemaName: "org.gnome.shell.extensions.hibernate-status-button",
    /**
     * The GSettings-object to read/write from/to.
     * @private
     */
    _setting: {},
    /**
     * Creates a new Settings-object to access the settings of this extension.
     * @private
     */
    _init: function(){
        let schemaDir = Me.dir.get_child('schemas').get_path();

        let schemaSource = Gio.SettingsSchemaSource.new_from_directory(
            schemaDir, Gio.SettingsSchemaSource.get_default(), false
        );
        let schema = schemaSource.lookup(this._schemaName, false);

        this._setting = new Gio.Settings({
            settings_schema: schema
        });
    },
    /**
     * <p>Binds the given 'callback'-function to the "changed"-signal on the given
     *  key.</p>
     * <p>The 'callback'-function is passed an argument which holds the new
     *  value of 'key'. The argument is of type "GLib.Variant". Given that the
     *  receiver knows the internal type, use one of the get_XX()-methods to get
     *  it's actual value.</p>
     * @see http://www.roojs.com/seed/gir-1.2-gtk-3.0/gjs/GLib.Variant.html
     * @param key the key to watch for changes.
     * @param callback the callback-function to call.
     */
    bindKey: function(key, callback){
        // Validate:
        if (key === undefined || key === null || typeof key !== "string"){
            throw TypeError("The 'key' should be a string. Got: '"+key+"'");
        }
        if (callback === undefined || callback === null || typeof callback !== "function"){
            throw TypeError("'callback' needs to be a function. Got: "+callback);
        }
        // Bind:
        this._setting.connect("changed::"+key, function(source, key){
            callback( source.get_value(key) );
        });
    },
    /**
     * Get if check for working hibernation is enabled. The user might 
     * choose to disable it if we happen to be wrong.
     * 
     * @returns bool true if we need to check if hibernation works.
     */
    getHibernateWorksCheckEnabled: function(){
        return this._setting.get_boolean(this.KEY_HIBERNATE_WORKS_CHECK);
    },
    /**
     * Set if check for working hibernation is enabled. The user might 
     * choose to disable it if we happen to be wrong.
     * 
     * @returns bool true if we need to check if hibernation works.
     */
    setHibernateWorksCheckEnabled: function(enabled) {
        let key = this.KEY_HIBERNATE_WORKS_CHECK;
        if (this._setting.is_writable(key)){
            if (this._setting.set_boolean(key, enabled)){
                Gio.Settings.sync();
            } else {
                throw this._errorSet(key);
            }
        } else {
            throw this._errorWritable(key);
        }
	},
    _errorWritable: function(key){
        return "The key '"+key+"' is not writable.";
    },
    _errorSet: function(key){
        return "Couldn't set the key '"+key+"'";
    }
});
