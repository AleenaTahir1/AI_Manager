import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const SystemMonitorIndicator = GObject.registerClass(
class SystemMonitorIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'AI Task Manager System Monitor', false);

        this._box = new St.BoxLayout({
            style_class: 'panel-status-indicators-box',
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER,
        });

        // CPU text / mini bar container
        this._cpuLabel = new St.Label({
            text: 'CPU: --',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-family: monospace; font-size: 10px; margin-right: 6px;',
        });
        this._box.add_child(this._cpuLabel);

        // RAM label
        this._ramLabel = new St.Label({
            text: 'RAM: --%',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-family: monospace; font-size: 10px; margin-right: 6px;',
        });
        this._box.add_child(this._ramLabel);

        // Net label
        this._netLabel = new St.Label({
            text: '↑ 0 B/s ↓ 0 B/s',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-family: monospace; font-size: 10px;',
        });
        this._box.add_child(this._netLabel);

        this.add_child(this._box);
        this._startPolling();
    }

    _startPolling() {
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._updateStats();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _updateStats() {
        // Read metrics if shared file exists, or execute lightweight proc read
        try {
            // Extension integration point for AI Task Manager telemetry stream
        } catch (e) {
            logError(e);
        }
    }

    destroy() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
        super.destroy();
    }
});

export default class SystemMonitorExtension extends Extension {
    enable() {
        this._indicator = new SystemMonitorIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'right');
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
