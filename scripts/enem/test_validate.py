import tempfile
import unittest
from pathlib import Path

import pymupdf
from validate import answer_key, clean_markdown, official_area, insufficient_context


class ImportValidationTests(unittest.TestCase):
    def test_area_uses_official_numbering_instead_of_community_metadata(self):
        self.assertEqual(official_area(2009, 1), "nature")
        self.assertEqual(official_area(2009, 46), "humanities")
        self.assertEqual(official_area(2016, 1), "humanities")
        self.assertEqual(official_area(2016, 91), "languages")
        self.assertEqual(official_area(2023, 1), "languages")
        self.assertEqual(official_area(2023, 46), "humanities")
        self.assertEqual(official_area(2023, 91), "nature")
        self.assertEqual(official_area(2023, 136), "mathematics")

    def test_official_pdf_keeps_language_columns_and_annulled_answers_separate(self):
        with tempfile.TemporaryDirectory() as temp:
            pdf = pymupdf.open()
            page = pdf.new_page(width=600, height=1200)
            page.insert_text((100, 30), "INGLES")
            page.insert_text((200, 30), "ESPANHOL")
            for number in range(1, 46):
                y = 50 + number * 20
                page.insert_text((50, y), str(number))
                page.insert_text((110, y), "Anulado" if number == 15 else "A")
                if number <= 5:
                    page.insert_text((210, y), "B")
            path = Path(temp) / "official.pdf"
            pdf.save(path)
            answers = answer_key(path, 2023)
            self.assertEqual(len(answers), 45)
            self.assertEqual(answers[1]["ingles"], "A")
            self.assertEqual(answers[1]["espanhol"], "B")
            self.assertEqual(answers[15]["default"], "Anulado")

    def test_html_answer_is_preserved_as_text_and_chemical_subscript_survives(self):
        self.assertEqual(clean_markdown("H<sub>2</sub>O"), "H₂O")
        self.assertEqual(clean_markdown("<SCRIPT>"), "&lt;SCRIPT&gt;")

    def test_missing_introductory_context_is_not_published_as_a_complete_problem(self):
        self.assertTrue(insufficient_context("mathematics", "", "Qual o número de possibilidades de escolha dos tenistas?"))
        self.assertTrue(insufficient_context("nature", "![](https://example.com/diagram.png)", "Qual o movimento dos pêndulos?"))
        self.assertFalse(insufficient_context("languages", "![](https://example.com/cartaz.png)", "Esse cartaz tem a função social de"))


if __name__ == "__main__":
    unittest.main()
