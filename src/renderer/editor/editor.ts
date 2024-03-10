//////////////////////////////////////////////////////////////////////////////////////////
//   _  _ ____ _  _ ___  ____                                                           //
//   |_/  |__| |\ | |  \ |  |    This file belongs to Kando, the cross-platform         //
//   | \_ |  | | \| |__/ |__|    pie menu. Read more on github.com/kando-menu/kando     //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: MIT

import { Tooltip } from 'bootstrap';
import { EventEmitter } from 'events';

import { Sidebar } from './sidebar/sidebar';
import { Toolbar } from './toolbar/toolbar';
import { Background } from './background/background';
import { Preview } from './preview/preview';
import { Properties } from './properties/properties';
import { IMenuSettings } from '../../common';
import { toINode } from './editor-node';

/**
 * This class is responsible for the entire editor. It contains the preview, the
 * properties view, the sidebar and the toolbar. It is an event emitter and will emit the
 * following events:
 *
 * - 'enter-edit-mode': This is emitted when the user enters edit mode.
 * - 'leave-edit-mode': This is emitted when the user leaves edit mode.
 */
export class Editor extends EventEmitter {
  /** The container is the HTML element which contains the menu editor. */
  private container: HTMLElement = null;

  /**
   * The background is an opaque div which is shown when the editor is open. It
   * effectively hides the normal menu.
   */
  private background: Background = null;

  /**
   * The preview is shown in the center of the screen. It allows the user to edit one
   * level of the menu.
   */
  private preview: Preview = null;

  /**
   * The properties view is shown on the right side of the screen. It allows the user to
   * edit the properties of the currently selected menu item.
   */
  private properties: Properties = null;

  /**
   * The sidebar is displayed on the left screen edge. It contains some information about
   * Kando in general.
   */
  private sidebar: Sidebar = null;

  /**
   * The toolbar is displayed on the bottom of the screen. It allows the user to switch
   * between different menus, add new items, etc.
   */
  private toolbar: Toolbar = null;

  /**
   * These are the current menu settings. They are retrieved from the main process when
   * the user enters edit mode. It will modified by the user and then sent back to the
   * main process when the user leaves edit mode.
   */
  private menuSettings: IMenuSettings = null;

  /**
   * This constructor creates the HTML elements for the menu editor and wires up all the
   * functionality.
   */
  constructor(container: HTMLElement) {
    super();

    this.container = container;

    // Initialize the background.
    this.background = new Background();
    this.container.appendChild(this.background.getContainer());

    // Initialize the preview.
    this.preview = new Preview();
    this.container.appendChild(this.preview.getContainer());

    // Initialize the properties view.
    this.properties = new Properties();
    this.container.appendChild(this.properties.getContainer());

    // Initialize the sidebar.
    this.sidebar = new Sidebar();
    this.container.appendChild(this.sidebar.getContainer());

    // Initialize the toolbar. The toolbar also brings the buttons for entering and
    // leaving edit mode. We wire up the corresponding events here.
    this.toolbar = new Toolbar();
    this.toolbar.on('enter-edit-mode', () => this.enterEditMode());
    this.toolbar.on('leave-edit-mode', () => this.leaveEditMode());
    this.toolbar.on('expand', () => {
      this.preview.hide();
      this.properties.hide();
    });
    this.toolbar.on('collapse', () => {
      this.preview.show();
      this.properties.show();
    });
    this.toolbar.on('select-menu', (index: number) => {
      this.preview.setMenu(this.menuSettings.menus[index]);
    });
    this.container.appendChild(this.toolbar.getContainer());

    // Initialize all tooltips.
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((elem) => {
      new Tooltip(elem, {
        delay: { show: 500, hide: 0 },
      });
    });
  }

  /**
   * This is used to show the entire editor. Most likely, this will only show the sidebar,
   * the other components are hidden by default and will only be shown when
   * enterEditMode() is called.
   */
  public show() {
    this.container.classList.add('visible');
  }

  /**
   * This is used to hide the entire editor, including the sidebar. We also leave edit
   * mode if it is currently active. Else, the editor would be shown right away when the
   * user opens the menu again.
   */
  public hide() {
    this.container.classList.remove('visible');
    this.leaveEditMode();
  }

  /**
   * This shows the other components of the editor, such as the toolbar and the
   * background. To make sure that enough space is available, the sidebar is hidden.
   */
  public enterEditMode() {
    if (this.isInEditMode()) {
      return;
    }

    this.container.classList.add('edit-mode');
    this.sidebar.setVisibility(false);

    // Get the current settings from the main process and pass them to the respective
    // components.
    Promise.all([
      window.api.menuSettings.get(),
      window.api.menuSettings.getCurrentMenu(),
    ]).then(([settings, currentMenu]) => {
      this.menuSettings = settings;
      this.preview.setMenu(settings.menus[currentMenu]);
      this.toolbar.setMenus(settings.menus, currentMenu);
    });

    this.emit('enter-edit-mode');
  }

  /**
   * This hides the edit-mode components of the editor, such as the toolbar and the
   * background. The sidebar will remain visible if it is currently shown. The current
   * menu settings will be sent back to the main process and saved to disc over there.
   */
  public leaveEditMode() {
    if (!this.isInEditMode()) {
      return;
    }

    this.container.classList.remove('edit-mode');

    if (this.menuSettings) {
      // Before sending the menu settings back to the main process, we have to make sure
      // that the menu nodes are converted back to INode objects. This is because
      // IEditorNode objects contain properties (such as DOM nodes) which neither need to
      // be saved to disc nor can they be cloned using the structured clone algorithm
      // which is used by Electron for IPC.
      this.menuSettings.menus.forEach((menu) => {
        menu.nodes = toINode(menu.nodes);
      });

      window.api.menuSettings.set(this.menuSettings);
      this.menuSettings = null;
    }

    this.emit('leave-edit-mode');
  }

  /** This method returns true if the editor is currently in edit mode. */
  public isInEditMode(): boolean {
    return this.container.classList.contains('edit-mode');
  }
}
