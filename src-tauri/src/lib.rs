// ═══════════════════════════════════════════════════════════════
// NEBULA Oracle Terminal · Tauri 2 backend
// ═══════════════════════════════════════════════════════════════

use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // ─── Tauri plugins ───
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))

        // ─── Global Shortcut плагин с обработчиком ───
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }

                    // Ctrl+Shift+B — показать/скрыть главное окно
                    if shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyB) {
                        if let Some(w) = app.get_webview_window("main") {
                            let is_visible = w.is_visible().unwrap_or(false);
                            if is_visible {
                                let _ = w.hide();
                                println!("[hotkey] Ctrl+Shift+B → hide main");
                            } else {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                                println!("[hotkey] Ctrl+Shift+B → show main");
                            }
                        }
                    }

                    // Ctrl+Shift+M — открыть/скрыть mini-окно
                    if shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyM) {
                        if let Some(w) = app.get_webview_window("mini") {
                            let is_visible = w.is_visible().unwrap_or(false);
                            if is_visible {
                                let _ = w.hide();
                                println!("[hotkey] Ctrl+Shift+M → hide mini");
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                                println!("[hotkey] Ctrl+Shift+M → show mini");
                            }
                        }
                    }
                })
                .build(),
        )

        // ─── Setup: трей + регистрация хоткеев ───
        .setup(|app| {
            use tauri::tray::TrayIconBuilder;
            use tauri::menu::{Menu, MenuItem};

            // ── Трей ──
            if app.tray_by_id("nebula-tray").is_none() {
                let show_item = MenuItem::with_id(app, "show", "Показать NEBULA", true, None::<&str>)?;
                let mini_item = MenuItem::with_id(app, "mini", "Mini-режим", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_item, &mini_item, &quit_item])?;

                let _tray = TrayIconBuilder::with_id("nebula-tray")
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("NEBULA Oracle Terminal")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                            }
                        }
                        "mini" => {
                            if let Some(w) = app.get_webview_window("mini") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        use tauri::tray::TrayIconEvent;
                        if let TrayIconEvent::Click { button, button_state, .. } = event {
                            if button == tauri::tray::MouseButton::Left
                                && button_state == tauri::tray::MouseButtonState::Up
                            {
                                let app = tray.app_handle();
                                if let Some(w) = app.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.unminimize();
                                    let _ = w.set_focus();
                                }
                            }
                        }
                    })
                    .build(app)?;

                println!("[tray] created");
            }

            // ── Регистрация хоткеев ──
            let shortcut_b = Shortcut::new(
                Some(Modifiers::CONTROL | Modifiers::SHIFT),
                Code::KeyB,
            );
            let shortcut_m = Shortcut::new(
                Some(Modifiers::CONTROL | Modifiers::SHIFT),
                Code::KeyM,
            );

            // Сначала снимаем возможные старые регистрации
            let _ = app.global_shortcut().unregister_all();

            if let Err(e) = app.global_shortcut().register(shortcut_b) {
                eprintln!("[hotkey] failed to register Ctrl+Shift+B: {}", e);
            } else {
                println!("[hotkey] registered Ctrl+Shift+B");
            }

            if let Err(e) = app.global_shortcut().register(shortcut_m) {
                eprintln!("[hotkey] failed to register Ctrl+Shift+M: {}", e);
            } else {
                println!("[hotkey] registered Ctrl+Shift+M");
            }

            Ok(())
        })

        // ─── Чистое закрытие окна ───
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    // Снимаем хоткеи перед выходом
                    let app_handle = window.app_handle().clone();
                    let _ = app_handle.global_shortcut().unregister_all();

                    // Даём 200 мс на graceful shutdown и убиваем
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(200));
                        app_handle.exit(0);
                    });
                } else {
                    // Mini-окно — просто скрываем
                    let _ = window.hide();
                }
            }
        })

        // ─── Run ───
        .run(tauri::generate_context!())
        .expect("error while running NEBULA");
}