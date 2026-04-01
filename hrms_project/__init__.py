import pymysql

# Simulate a version of mysqlclient that satisfies Django 6
pymysql.version_info = (2, 2, 1, "final", 0)
pymysql.install_as_MySQLdb()

# Monkeypatch Django's DB version logic to accept MariaDB 10.4 servers locally
try:
    from django.db.backends.mysql.base import DatabaseWrapper
    from django.db.backends.mysql.features import DatabaseFeatures
    
    DatabaseWrapper.check_database_version_supported = lambda self: True
    
    # Disable RETURNING syntax since MariaDB 10.4 doesn't support it
    DatabaseFeatures.can_return_columns_from_insert = False
    DatabaseFeatures.can_return_rows_from_bulk_insert = False
except (ImportError, AttributeError):
    pass
