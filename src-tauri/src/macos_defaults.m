#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

// Check if OmniDoc is default for given UTI string
// Returns: 1 if is default, 0 if not default, -1 on error
int macos_is_default_for_uti(const char *uti_cstr) {
    @autoreleasepool {
        if (!uti_cstr) return -1;
        NSString *utiStr = [NSString stringWithUTF8String:uti_cstr];
        UTType *type = [UTType typeWithIdentifier:utiStr];
        if (!type) return 0;
        
        NSURL *defaultAppUrl = [[NSWorkspace sharedWorkspace] URLForApplicationToOpenContentType:type];
        if (!defaultAppUrl) return 0;
        
        NSBundle *mainBundle = [NSBundle mainBundle];
        NSString *mainBundleId = [mainBundle bundleIdentifier];
        if (!mainBundleId) {
            mainBundleId = @"com.omnidoc.previewer";
        }
        
        NSBundle *defaultBundle = [NSBundle bundleWithURL:defaultAppUrl];
        if (defaultBundle && [defaultBundle.bundleIdentifier isEqualToString:mainBundleId]) {
            return 1;
        }
        
        // Also check if app URL matches bundle URL
        if ([defaultAppUrl.path isEqualToString:mainBundle.bundleURL.path]) {
            return 1;
        }
        
        return 0;
    }
}

// Get the display name of current default app for UTI (caller must free returned string)
char *macos_get_default_app_name_for_uti(const char *uti_cstr) {
    @autoreleasepool {
        if (!uti_cstr) return NULL;
        NSString *utiStr = [NSString stringWithUTF8String:uti_cstr];
        UTType *type = [UTType typeWithIdentifier:utiStr];
        if (!type) return NULL;
        
        NSURL *appUrl = [[NSWorkspace sharedWorkspace] URLForApplicationToOpenContentType:type];
        if (!appUrl) return NULL;
        
        NSBundle *bundle = [NSBundle bundleWithURL:appUrl];
        NSString *name = nil;
        if (bundle) {
            name = [bundle objectForInfoDictionaryKey:@"CFBundleDisplayName"];
            if (!name) {
                name = [bundle objectForInfoDictionaryKey:@"CFBundleName"];
            }
        }
        if (!name) {
            name = [appUrl.lastPathComponent stringByDeletingPathExtension];
        }
        return name ? strdup([name UTF8String]) : NULL;
    }
}

// Set OmniDoc as default application for given UTI. Triggers native macOS system confirmation sheet!
// Returns 0 on success, -1 on failure
int macos_set_default_app_for_uti(const char *uti_cstr) {
    @autoreleasepool {
        if (!uti_cstr) return -1;
        NSString *utiStr = [NSString stringWithUTF8String:uti_cstr];
        UTType *type = [UTType typeWithIdentifier:utiStr];
        if (!type) return -1;
        
        NSURL *appUrl = [NSBundle mainBundle].bundleURL;
        
        // If running in development (outside .app bundle), try finding OmniDoc.app on Desktop or Applications
        NSFileManager *fm = [NSFileManager defaultManager];
        if (![appUrl.pathExtension isEqualToString:@"app"]) {
            NSString *desktopApp = [NSHomeDirectory() stringByAppendingPathComponent:@"Desktop/OmniDoc.app"];
            NSString *appsApp = @"/Applications/OmniDoc.app";
            if ([fm fileExistsAtPath:desktopApp]) {
                appUrl = [NSURL fileURLWithPath:desktopApp];
            } else if ([fm fileExistsAtPath:appsApp]) {
                appUrl = [NSURL fileURLWithPath:appsApp];
            }
        }
        
        dispatch_semaphore_t sem = dispatch_semaphore_create(0);
        __block int result = 0;
        
        [[NSWorkspace sharedWorkspace] setDefaultApplicationAtURL:appUrl toOpenContentType:type completionHandler:^(NSError * _Nullable error) {
            if (error) {
                NSLog(@"[OmniDoc] setDefaultApplication failed: %@", error.localizedDescription);
                result = -1;
            } else {
                NSLog(@"[OmniDoc] setDefaultApplication succeeded for %@", utiStr);
                result = 0;
            }
            dispatch_semaphore_signal(sem);
        }];
        
        // Wait up to 10 seconds for user response
        dispatch_semaphore_wait(sem, dispatch_time(DISPATCH_TIME_NOW, 10 * NSEC_PER_SEC));
        return result;
    }
}

// Reset default app to macOS standard system application
int macos_reset_default_app_for_uti(const char *uti_cstr) {
    @autoreleasepool {
        if (!uti_cstr) return -1;
        NSString *utiStr = [NSString stringWithUTF8String:uti_cstr];
        UTType *type = [UTType typeWithIdentifier:utiStr];
        if (!type) return -1;
        
        NSFileManager *fm = [NSFileManager defaultManager];
        NSString *fallbackPath = @"/System/Applications/Preview.app";
        
        if ([utiStr containsString:@"spreadsheet"] || [utiStr containsString:@"excel"]) {
            if ([fm fileExistsAtPath:@"/System/Applications/Numbers.app"]) {
                fallbackPath = @"/System/Applications/Numbers.app";
            }
        } else if ([utiStr containsString:@"wordprocessing"] || [utiStr containsString:@"word"]) {
            if ([fm fileExistsAtPath:@"/System/Applications/Pages.app"]) {
                fallbackPath = @"/System/Applications/Pages.app";
            } else if ([fm fileExistsAtPath:@"/System/Applications/TextEdit.app"]) {
                fallbackPath = @"/System/Applications/TextEdit.app";
            }
        } else if ([utiStr containsString:@"presentation"] || [utiStr containsString:@"powerpoint"]) {
            if ([fm fileExistsAtPath:@"/System/Applications/Keynote.app"]) {
                fallbackPath = @"/System/Applications/Keynote.app";
            }
        } else if ([utiStr containsString:@"markdown"] || [utiStr containsString:@"plain-text"]) {
            if ([fm fileExistsAtPath:@"/System/Applications/TextEdit.app"]) {
                fallbackPath = @"/System/Applications/TextEdit.app";
            }
        }
        
        NSURL *fallbackUrl = [NSURL fileURLWithPath:fallbackPath];
        dispatch_semaphore_t sem = dispatch_semaphore_create(0);
        __block int result = 0;
        
        [[NSWorkspace sharedWorkspace] setDefaultApplicationAtURL:fallbackUrl toOpenContentType:type completionHandler:^(NSError * _Nullable error) {
            if (error) {
                result = -1;
            } else {
                result = 0;
            }
            dispatch_semaphore_signal(sem);
        }];
        
        dispatch_semaphore_wait(sem, dispatch_time(DISPATCH_TIME_NOW, 10 * NSEC_PER_SEC));
        return result;
    }
}

// Open System Settings
void macos_open_system_settings(void) {
    @autoreleasepool {
        NSURL *url = [NSURL URLWithString:@"x-apple.systempreferences:"];
        [[NSWorkspace sharedWorkspace] openURL:url];
    }
}
