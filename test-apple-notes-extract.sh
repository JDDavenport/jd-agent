#!/bin/bash
# Test extracting a single Apple Note

osascript <<'EOF'
tell application "Notes"
    set notesList to every note
    if (count of notesList) > 0 then
        set firstNote to item 1 of notesList
        set noteTitle to name of firstNote
        set noteBody to body of firstNote
        set noteCreated to creation date of firstNote
        set noteModified to modification date of firstNote

        return "Title: " & noteTitle & "
Created: " & noteCreated & "
Modified: " & noteModified & "
Body length: " & (length of noteBody) & " chars"
    end if
end tell
EOF
