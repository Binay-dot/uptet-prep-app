# Local setup — Windows / PowerShell notes

These are gotchas encountered while setting this up. Read this before
debugging something that "should just work."

## Creating a .env file
Don't create it in Notepad and save as `.env` — Windows silently saves it as
`.env.txt`. Do it from PowerShell instead:

```powershell
"OPENAI_API_KEY=sk-your-real-key-here" | Out-File -FilePath .env -Encoding ascii -NoNewline
```

Verify it's really there (dotfiles are hidden by default):

```powershell
dir -Force
```

## Activating a virtual environment
```powershell
python -m venv venv
venv\Scripts\Activate.ps1
```

If PowerShell blocks this with an "execution policy" error, run once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

You should see `(venv)` at the start of your prompt once it's active.

## pip not found / installing into the wrong environment
- `%pip install ...` is a Jupyter/IPython notebook magic command — it does
  NOT work in a plain PowerShell terminal. In PowerShell, just use:
  ```powershell
  pip install <package>
  # or, if that's not found:
  python -m pip install <package>
  ```
- If you're running code in a Jupyter/interactive notebook cell instead of
  a plain script, `%pip install` (with the %) is correct there — but
  remember to restart the kernel afterwards, and make sure the notebook's
  kernel is actually your activated venv, not a different Python install.

## "No such file or directory" when running a script
This almost always means the file isn't actually where you think it is, or
it's empty. Before assuming a tool/package problem, check:

```powershell
dir
dir *.py
```

Confirm the file is listed and its size is not 0 bytes.

## Model-specific API quirks (OpenAI)
Some newer models (e.g. `gpt-6-astra`) reject a custom `temperature` value —
only the default is accepted. If you get
`Unsupported value: 'temperature' does not support ...`, just remove the
`temperature` parameter from the API call entirely.
