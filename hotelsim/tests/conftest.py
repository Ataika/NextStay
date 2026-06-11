import pytest

from hotelsim.store import Store


@pytest.fixture()
def store():
    s = Store(":memory:")
    s.init_schema()
    yield s
    s.close()
