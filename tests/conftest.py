import json
import sys
from functools import lru_cache
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tests" / "fixtures"))

AS_OF = "2026-10-20"
PROFILE = {"name": "Jordan Sample", "mailing": ["100 Example Ave", "Anytown, TX 75001-1234"], "dob": "1980-01-01",
           "ssn_last4": "0000", "facts": {}}


@lru_cache(maxsize=None)
def _items(name):
    from errata.pdftext import pdf_items
    return json.dumps(pdf_items(str(ROOT / "tests" / "fixtures" / name)))


def items(name):
    return json.loads(_items(name))


def report(name):
    from errata import tu
    return tu.parse(items(name))


@pytest.fixture
def planted():
    return report("tu_planted.pdf")


@pytest.fixture
def clean():
    return report("tu_clean.pdf")


@pytest.fixture
def round2():
    return report("tu_round2.pdf")
