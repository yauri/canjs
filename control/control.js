// 1.28
steal('can/construct', 'can/util/destroyed.js', function( $ ) {
	// ------- HELPER FUNCTIONS  ------
	
	// Binds an element, returns a function that unbinds
	var bind = function( el, ev, callback ) {
		can.bind.call( el, ev, callback )
		//var binder = el.bind && el.unbind ? el : $(isFunction(el) ? [el] : el);

		//binder.bind(ev, callback);
		// if ev name has >, change the name and bind
		// in the wrapped callback, check that the element matches the actual element
		return function() {
			can.unbind.call(el, ev, callback);
		};
	},
		isFunction = can.isFunction,
		extend = can.extend,
		each = can.each,
		slice = [].slice,
		special = ($.event && $.event.special) || {},

		// Binds an element, returns a function that unbinds
		delegate = function( el, selector, ev, callback ) {
			//var binder = el.delegate && el.undelegate ? el : $(isFunction(el) ? [el] : el)
			//binder.delegate(selector, ev, callback);
			can.delegate.call(el, selector, ev, callback)
			return function() {
				can.undelegate.call(el, selector, ev, callback);
			};
		},
		
		// calls bind or unbind depending if there is a selector
		binder = function( el, ev, callback, selector ) {
			return selector ?
				delegate( el, can.trim( selector ), ev, callback ) : 
				bind( el, ev, callback );
		},
		
		// moves 'this' to the first argument, wraps it with jQuery if it's an element
		shifter = function shifter(context, name) {
			var method = typeof name == "string" ? context[name] : name;
			return function() {
				context.called = name;
    			return method.apply(context, [this.nodeName ? can.$(this) : this].concat( slice.call(arguments, 0)));
			};
		},
		basicProcessor;
	
	/**
	 * @add can.Control
	 */
	can.Construct("can.Control",
	/** 
	 * @Static
	 */
	{
		/**
		 * @hide
		 * 
		 * Setup pre-process which methods are event listeners.
		 * 
		 */
		setup: function() {

			// Allow contollers to inherit "defaults" from superclasses as it done in can.Construct
			can.Construct.setup.apply( this, arguments );

			// if you didn't provide a name, or are control, don't do anything
			if ( this !== can.Control ) {

				// cache the underscored names
				var control = this,
					/**
					* @hide
					* @attribute pluginName
					* Setting the <code>pluginName</code> property allows you
					* to change the jQuery plugin helper name from its 
					* default value.
					* 
					*     can.Control("Mxui.Layout.Fill",{
					*       pluginName: "fillWith"
					*     },{});
					*     
					*     $("#foo").fillWith();
					*/
					pluginName = control.pluginName || control._fullName,
					funcName;

				// calculate and cache actions
				control.actions = {};

				for ( funcName in control.prototype ) {
					if (funcName == 'constructor' || ! isFunction(control.prototype[funcName]) ) {
						continue;
					}
					if ( control._isAction(funcName) ) {
						control.actions[funcName] = control._action(funcName);
					}
				}
			}
		},
		/**
		 * @hide
		 * @param {String} methodName a prototype function
		 * @return {Boolean} truthy if an action or not
		 */
		_isAction: function( methodName ) {
			// RegExp literals don't carry a last index property so this is
			// safe
			return special[methodName] || processors[methodName] || /[^\w]/.test(methodName);
		},
		/**
		 * @hide
		 * Takes a method name and the options passed to a control
		 * and tries to return the data necessary to pass to a processor
		 * (something that binds things).
		 * 
		 * For performance reasons, this called twice.  First, it is called when 
		 * the Control class is created.  If the methodName is templated
		 * like : "{window} foo", it returns null.  If it is not templated
		 * it returns event binding data.
		 * 
		 * The resulting data is added to this.actions.
		 * 
		 * When a control instance is created, _action is called again, but only
		 * on templated actions.  
		 * 
		 * @param {Object} methodName the method that will be bound
		 * @param {Object} [options] first param merged with class default options
		 * @return {Object} null or the processor and pre-split parts.  
		 * The processor is what does the binding/subscribing.
		 */
		_action: function( methodName, options ) {
			// reset the test index
			
			//if we don't have options (a control instance), we'll run this later
			                  // Parameter replacer regex
			if ( options || ! /\{([^\}]+)\}/g.test( methodName )) {
				// If we have options, run sub to replace templates "{}" with a value from the options
				// or the window
				var convertedName = options ? can.String.sub(methodName, [options, window]) : methodName,
					
					// If a "{}" resolves to an object, convertedName will be an array
					arr = can.isArray(convertedName),
					
					// get the parts of the function = [convertedName, delegatePart, eventPart]
					                                                       // Breaker regex
					parts = (arr ? convertedName[1] : convertedName).match(/^(?:(.*?)\s)?([\w\.\:>]+)$/),
					event = parts[2],
					processor = processors[event] || basicProcessor;
				return {
					processor: processor,
					parts: parts,
					delegate : arr ? convertedName[0] : undefined
				};
			}
		},
		/**
		 * @attribute processors
		 * An object of {eventName : function} pairs that Control uses to hook up events
		 * auto-magically.  A processor function looks like:
		 * 
		 *     jQuery.Control.processors.
		 *       myprocessor = function( el, event, selector, cb, control ) {
		 *          //el - the control's element
		 *          //event - the event (myprocessor)
		 *          //selector - the left of the selector
		 *          //cb - the function to call
		 *          //control - the binding control
		 *       };
		 * 
		 * This would bind anything like: "foo~3242 myprocessor".
		 * 
		 * The processor must return a function that when called, 
		 * unbinds the event handler.
		 * 
		 * Control already has processors for the following events:
		 * 
		 *   - change 
		 *   - click 
		 *   - contextmenu 
		 *   - dblclick 
		 *   - focusin
		 *   - focusout
		 *   - keydown 
		 *   - keyup 
		 *   - keypress 
		 *   - mousedown 
		 *   - mouseenter
		 *   - mouseleave
		 *   - mousemove 
		 *   - mouseout 
		 *   - mouseover 
		 *   - mouseup 
		 *   - reset 
		 *   - resize 
		 *   - scroll 
		 *   - select 
		 *   - submit  
		 * 
		 * Listen to events on the document or window 
		 * with templated event handlers:
		 * 
		 *
		 *     can.Control('Sized',{
		 *       "{window} resize" : function(){
		 *         this.element.width(this.element.parent().width() / 2);
		 *       }
		 *     });
		 *     
		 *     $('.foo').sized();
		 */
		processors: {},
		/**
		 * @attribute defaults
		 * A object of name-value pairs that act as default values for a control's 
		 * [can.Control::options this.options].
		 * 
		 *     Message = can.Control({
		 *       defaults : {
		 *         message : "Hello World"
		 *       }
		 *     },{
		 *       init : function(){
		 *         this.element.text(this.options.message);
		 *       }
		 *     })
		 *     
		 *     new Message("#el1"); //writes "Hello World"
		 *     new Message("#el12",{message: "hi"}); //writes hi
		 *     
		 * In [can.Control::setup] the options passed to the control
		 * are merged with defaults.  This is not a deep merge.
		 */
		defaults: {}
	},
	/** 
	 * @Prototype
	 */
	{
		/**
		 * Setup is where most of control's magic happens.  It does the following:
		 * 
		 * ### 1. Sets this.element
		 * 
		 * The first parameter passed to new Control(el, options) is expected to be 
		 * an element.  This gets converted to a jQuery wrapped element and set as
		 * [jQuery.Control.prototype.element this.element].
		 * 
		 * ### 2. Adds the control's name to the element's className.
		 * 
		 * Control adds it's plugin name to the element's className for easier 
		 * debugging.  For example, if your Control is named "Foo.Bar", it adds
		 * "foo_bar" to the className.
		 * 
		 * ### 3. Saves the control in $.data
		 * 
		 * A reference to the control instance is saved in $.data.  You can find 
		 * instances of "Foo.Bar" like: 
		 * 
		 *     $("#el").data("controls")['foo_bar'].
		 * 
		 * ### Binds event handlers
		 * 
		 * Setup does the event binding described in [jquery.control.listening Listening To Events].
		 * 
		 * @param {HTMLElement} element the element this instance operates on.
		 * @param {Object} [options] option values for the control.  These get added to
		 * this.options and merged with [jQuery.Control.static.defaults defaults].
		 * @return {Array} return an array if you wan to change what init is called with. By
		 * default it is called with the element and options passed to the control.
		 */
		setup: function( element, options ) {
			var cls = this.constructor,
				pluginname = cls.pluginName || cls._fullName;

			// want the raw element here
			this.element = can.$(element)

			if( pluginname && pluginname !== 'can_control') {
				//set element and className on element
				this.element.addClass(pluginname);
			}
			
			(can.data(this.element,"controls")) || can.data(this.element,"controls", [ this ]);
			
			/**
			 * @attribute options
			 * 
			 * Options are used to configure an control.  They are
			 * the 2nd argument
			 * passed to a control (or the first argument passed to the 
			 * [jquery.control.plugin control's jQuery plugin]).
			 * 
			 * For example:
			 * 
			 *     can.Control('Hello')
			 *     
			 *     var h1 = new Hello($('#content1'), {message: 'World'} );
			 *     equal( h1.options.message , "World" )
			 *     
			 *     var h2 = $('#content2').hello({message: 'There'})
			 *                            .control();
			 *     equal( h2.options.message , "There" )
			 * 
			 * Options are merged with [jQuery.Control.static.defaults defaults] in
			 * [jQuery.Control.prototype.setup setup].
			 * 
			 * For example:
			 * 
			 *     can.Control("Tabs", 
			 *     {
			 *        defaults : {
			 *          activeClass: "ui-active-state"
			 *        }
			 *     },
			 *     {
			 *        init : function(){
			 *          this.element.addClass(this.options.activeClass);
			 *        }
			 *     })
			 *     
			 *     $("#tabs1").tabs()                         // adds 'ui-active-state'
			 *     $("#tabs2").tabs({activeClass : 'active'}) // adds 'active'
			 *     
			 * Options are typically updated by calling 
			 * [jQuery.Control.prototype.update update];
			 *
			 */
			this.options = extend({}, cls.defaults, options);

			// bind all event handlers
			this.on();

			/**
			 * @attribute element
			 * 
			 * The control instance's HTMLElement (or window) wrapped by the 
			 * util library for ease of use. It is set by the first
			 * parameter to `new can.Construct(element, options)` 
			 * in [can.Control::setup].  Control listens on `this.element`
			 * for events.
			 * 
			 * ### Quick Example
			 * 
			 * The following `HelloWorld` control sets the control`s text to "Hello World":
			 * 
			 *     HelloWorld = can.Control({
			 *       init : function(){
			 * 	       this.element.text('Hello World')
			 *       }
			 *     })
			 *     
			 *     // create the controller on the element
			 *     new HelloWorld(document.getElementById('#helloworld'))
			 * 
			 * 
			 * ## Wrapped NodeList
			 * 
			 * `this.element` is a wrapped NodeList of one HTMLELement (or window).  This
			 * is for convience in libraries like jQuery where all methods operate only on a
			 * NodeList.  To get the raw HTMLElement, write:
			 * 
			 *     this.element[0] //-> HTMLElement
			 * 
			 * The following details the NodeList used by each library with 
			 * an example of updating it's text:
			 * 
			 * __jQuery__ `jQuery( HTMLElement )`
			 * 
			 *     this.element.text("Hello World")
			 * 
			 * __Zepto__ `Zepto( HTMLElement )`
			 * 
			 *     this.element.text("Hello World")
			 * 
			 * __Dojo__ `new dojo.NodeList( HTMLElement )`
			 * 
			 *     // TODO
			 * 
			 * __Mootools__ `$$( HTMLElement )`
			 * 
			 *    this.element.empty().appendText("Hello World")
			 * 
			 * __YUI__ 
			 * 
			 *    // TODO
			 * 
			 * 
			 * ## Changing `this.element`
			 * 
			 * Sometimes you don't want what's passed to `new can.Control`
			 * to be this.element.  You can change this by overwriting
			 * setup or by unbinding, setting this.element, and rebinding.
			 * 
			 * ### Overwriting Setup
			 * 
			 * The following Combobox overwrites setup to wrap a
			 * select element with a div.  That div is used 
			 * as `this.element`. Notice how `destroy` sets back the
			 * original element.
			 * 
			 *     Combobox = can.Control({
			 *       setup : function(el, options){
			 *          this.oldElement = $(el);
			 *          var newEl = $('<div/>');
			 *          this.oldElement.wrap(newEl);
			 *          can.Controll.prototype.setup.call(this, newEl, options);
			 *       },
			 *       init : function(){
			 *          this.element //-> the div
			 *       },
			 *       ".option click" : function(){
			 *         // event handler bound on the div
			 *       },
			 *       destroy : function(){
			 *          var div = this.element; //save reference
			 *          can.Control.prototype.destroy.call(this);
			 *          div.replaceWith(this.oldElement);
			 *       }
			 *     })
			 * 
			 * ### unbining, setting, and rebinding.
			 * 
			 * You could also change this.element by calling
			 * [can.Control::off], setting this.element, and 
			 * then calling [can.Control::on] like:
			 * 
			 *     move : function(newElement) {
			 *        this.off();
			 *        this.element = $(newElement);
			 *        this.on();  
			 *     }
			 */
			return [this.element, this.options];
		},
		/**
		 * `this.on( [element, selector, eventName, handler] )` is used to rebind 
		 * all event handlers when [can.Control::options this.options] has changed.  It
		 * can also be used to bind or delegate from other elements or objects.
		 * 
		 * ## Rebinding
		 * 
		 * By using templated event handlers, a control can listen to objects outside
		 * `this.element`.  This is extremely common in MVC programming.  For example,
		 * the following control might listen to a task model's `completed` property and
		 * toggle a strike className like:
		 * 
		 *     TaskStriker = can.Control({
		 *       "{task} completed" : function(){
		 * 	       this.update();
		 *       },
		 *       update : function(){
		 *         if(this.options.task.completed){
		 * 	         this.element.addClass('strike')
		 * 	       } else {
		 *           this.element.removeClass('strike')
		 *         }
		 *       }
		 *     }) 
		 * 
		 *     var taskstriker = new TaskStriker({ 
		 *       task: new Task({completed: 'true'}) 
		 *     })
		 * 
		 * To update the taskstriker's task, add a task method that updates
		 * this.options and calls rebind like:
		 * 
		 *     TaskStriker = can.Control({
		 *       "{task} completed" : function(){
		 * 	       this.update();
		 *       },
		 *       update : function(){
		 *         if(this.options.task.completed){
		 * 	         this.element.addClass('strike')
		 * 	       } else {
		 *           this.element.removeClass('strike')
		 *         }
		 *       },
		 *       task : function(newTask){
		 *         this.options.task = newTask;
		 *         this.on();
		 *         this.update();
		 *       }
		 *     });
		 * 
		 *     var taskstriker = new TaskStriker({ 
		 *       task: new Task({completed: true}) 
		 *     });
		 *     taskstriker.task( new TaskStriker({ 
		 *       task: new Task({completed: false}) 
		 *     }))
		 * 
		 * ## Adding new events
		 * 
		 * If events need to be bound to outside of the control and templated event handlers
		 * are not sufficent, you can call this.on to bind or delegate programatically:
		 * 
		 *     init: function() {
		 *        // calls somethingClicked(el,ev)
		 *        this.on('click','somethingClicked') 
		 *     
		 *        // calls function when the window is clicked
		 *        this.on(window, 'click', function(ev){
		 *          //do something
		 *        })
		 *     },
		 *     somethingClicked: function( el, ev ) {
		 *       
		 *     }
		 * 
		 * @param {HTMLElement|jQuery.fn|Object} [el=this.element] 
		 * The element to be bound.  If an eventName is provided,
		 * the control's element is used instead.
		 * @param {String} [selector] A css selector for event delegation.
		 * @param {String} [eventName] The event to listen for.
		 * @param {Function|String} [func] A callback function or the String name of a control function.  If a control
		 * function name is given, the control function is called back with the bound element and event as the first
		 * and second parameter.  Otherwise the function is called back like a normal bind.
		 * @return {Integer} The id of the binding in this._bindings
		 */
		on: function( el, selector, eventName, func ) {
			
			if ( ! el ) {
				//adds bindings
				this.off();
				//go through the cached list of actions and use the processor to bind
				
				var cls = this.constructor,
					bindings = this._bindings,
					actions = cls.actions,
					element = this.element,
					destroyCB = shifter(this,"destroy");
					
				for ( funcName in actions ) {
					if ( actions.hasOwnProperty( funcName )) {
						ready = actions[funcName] || cls._action(funcName, this.options);
						bindings.push(
							ready.processor(ready.delegate || element, 
							                ready.parts[2], 
											ready.parts[1], 
											funcName, 
											this));
					}
				}
	
	
				// setup to be destroyed ... don't bind b/c we don't want to remove it
				can.bind.call(element,"destroyed", destroyCB);
				bindings.push(function( el ) {
					can.unbind.call(el,"destroyed", destroyCB);
				});
				return bindings.length;
			}

			if ( typeof el == 'string' ) {
				func = eventName;
				eventName = selector;
				selector = el;
				el = this.element;
			}
			
			if ( typeof func == 'string' ) {
				func = shifter(this,func);
			}

			this._bindings.push( binder( el, eventName, func, selector ));

			return this._bindings.length;
		},
		/**
		 * @hide
		 * Unbinds all event handlers on the controller. You should never
		 * be calling this unless in use with [can.Control::on].
		 * 
		 * 
		 */
		off : function(){
			var el = this.element[0]
			each(this._bindings || [], function( key, value ) {
				value(el);
			});
			//adds bindings
			this._bindings = [];
		},
		/**
		 * @hide
		 * Update extends [jQuery.Control.prototype.options this.options] 
		 * with the `options` argument and rebinds all events.  It basically
		 * re-configures the control.
		 * 
		 * For example, the following control wraps a recipe form. When the form
		 * is submitted, it creates the recipe on the server.  When the recipe
		 * is `created`, it resets the form with a new instance.
		 * 
		 *     can.Control('Creator',{
		 *       "{recipe} created" : function(){
		 *         this.update({recipe : new Recipe()});
		 *         this.element[0].reset();
		 *         this.find("[type=submit]").val("Create Recipe")
		 *       },
		 *       "submit" : function(el, ev){
		 *         ev.preventDefault();
		 *         var recipe = this.options.recipe;
		 *         recipe.attrs( this.element.formParams() );
		 *         this.find("[type=submit]").val("Saving...")
		 *         recipe.save();
		 *       }
		 *     });
		 *     $('#createRecipes').creator({recipe : new Recipe()})
		 * 
		 * 
		 * @demo jquery/control/demo-update.html
		 * 
		 * Update is called if a control's [jquery.control.plugin jQuery helper] is 
		 * called on an element that already has a control instance
		 * of the same type. 
		 * 
		 * For example, a widget that listens for model updates
		 * and updates it's html would look like.  
		 * 
		 *     can.Control('Updater',{
		 *       // when the control is created, update the html
		 *       init : function(){
		 *         this.updateView();
		 *       },
		 *       
		 *       // update the html with a template
		 *       updateView : function(){
		 *         this.element.html( "content.ejs",
		 *                            this.options.model ); 
		 *       },
		 *       
		 *       // if the model is updated
		 *       "{model} updated" : function(){
		 *         this.updateView();
		 *       },
		 *       update : function(options){
		 *         // make sure you call super
		 *         this._super(options);
		 *          
		 *         this.updateView();
		 *       }
		 *     })
		 * 
		 *     // create the control
		 *     // this calls init
		 *     $('#item').updater({model: recipe1});
		 *     
		 *     // later, update that model
		 *     // this calls "{model} updated"
		 *     recipe1.update({name: "something new"});
		 *     
		 *     // later, update the control with a new recipe
		 *     // this calls update
		 *     $('#item').updater({model: recipe2});
		 *     
		 *     // later, update the new model
		 *     // this calls "{model} updated"
		 *     recipe2.update({name: "something newer"});
		 * 
		 * _NOTE:_ If you overwrite `update`, you probably need to call
		 * this._super.
		 * 
		 * ### Example
		 * 
		 *     can.Control("Thing",{
		 *       init: function( el, options ) {
		 *         alert( 'init:'+this.options.prop )
		 *       },
		 *       update: function( options ) {
		 *         this._super(options);
		 *         alert('update:'+this.options.prop)
		 *       }
		 *     });
		 *     $('#myel').thing({prop : 'val1'}); // alerts init:val1
		 *     $('#myel').thing({prop : 'val2'}); // alerts update:val2
		 * 
		 * @param {Object} options A list of options to merge with 
		 * [jQuery.Control.prototype.options this.options].  Often, this method
		 * is called by the [jquery.control.plugin jQuery helper function].
		 */
		update: function( options ) {
			extend(this.options, options);
			this.on();
		},
		/**
		 * `destroy` prepares a control for garbage collection and is a place to
		 * reset any changes the control has made.  
		 * 
		 * ## Allowing Garbage Collection
		 * 
		 * Destroy is called whenever a control's element is removed from the page using 
		 * the library's standard HTML modifier methods.  This means that you
		 * don't have to call destroy yourself and it 
		 * will be called automatically when appropriate.  
		 * 
		 * The following `Clicker` widget listens on the window for clicks and updates
		 * its element's innerHTML.  If we remove the element, the window's event handler
		 * is removed auto-magically:
		 *  
		 * 
		 *      Clickr = can.Control({
		 *       "{window} click" : function(){
		 * 	       this.element.html( this.count ? 
		 * 	                          this.count++ : this.count = 0)
		 *       }  
		 *     })
		 *     
		 *     // create a clicker on an element
		 *     new Clicker("#clickme");
		 * 
		 *     // remove the element
		 *     $('#clickme').remove();
		 * 
		 * 
		 * The methods you can use that will destroy controls automatically by library:
		 * 
		 * __jQuery and Zepto__
		 * 
		 *   - $.fn.remove
		 *   - $.fn.html
		 *   - $.fn.replaceWith
		 *   - $.fn.empty
		 * 
		 * __Dojo__
		 * 
		 *   - dojo.destroy
		 *   - dojo.empty
		 *   - dojo.place (with the replace option)
		 * 
		 * __Mootools__
		 * 
		 *   - Element.prototype.destroy
		 * 
		 * __YUI__
		 * 
		 *   - TODO!
		 * 
		 * 
		 * ## Teardown in Destroy
		 * 
		 * Sometimes, you want to reset a controlled element back to its
		 * original state when the control is destroyed.  Overwriting destroy
		 * lets you write teardown code of this manner.  __When overwriting
		 * destroy, make sure you call Control's base functionality__.
		 * 
		 * The following example changes an element's text when the control is
		 * created and sets it back when the control is removed:
		 * 
		 *     Changer = can.Control({
		 *       init : function(){
		 *         this.oldText = this.element.text();
		 *         this.element.text("Changed!!!")
		 *       },
		 *       destroy : function(){
		 *         this.element.text(this.oldText);
		 *         can.Control.prototype.destroy.call(this)
		 *     })
		 *     
		 *     // create a changer which changes #myel's text
		 *     var changer = new Changer('#myel')
		 * 
		 *     // destroy changer which will reset it
		 *     changer.destroy()
		 * 
		 * ## Base Functionality
		 * 
		 * Control prepares the control for garbage collection by:
		 * 
		 *   - unbinding all event handlers
		 *   - clearing references to this.element and this.options
		 *   - clearing the element's reference to the control
		 *   - removing it's [can.Control.pluginName] from the element's className
		 * 
		 */
		destroy: function() {
			var Class = this.constructor,
				pluginName = Class.pluginName || Class._fullName,
				controls;
			
			// unbind bindings
			this.off();
			
			if(pluginName && pluginName !== 'can_control'){
				// remove the className
				this.element.removeClass(pluginName);
			}
			
			// remove from data
			controls = can.data(this.element,"controls");
			controls.splice(can.inArray(this, controls),1);
			
			can.trigger( this, "destroyed"); //in case we want to know if the control is removed
			
			this.element = null;
		}
	});

	var processors = can.Control.processors,

	//------------- PROCESSSORS -----------------------------
	//processors do the binding.  They return a function that
	//unbinds when called.
	//the basic processor that binds events
	basicProcessor = function( el, event, selector, methodName, control ) {
		return binder( el, event, shifter(control, methodName), selector);
	};




	//set common events to be processed as a basicProcessor
	each(["change", "click", "contextmenu", "dblclick", "keydown", "keyup", "keypress", "mousedown", "mousemove", "mouseout", "mouseover", "mouseup", "reset", "resize", "scroll", "select", "submit", "focusin", "focusout", "mouseenter", "mouseleave"], function( i, v ) {
		processors[v] = basicProcessor;
	});
	

	

});